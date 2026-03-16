import { CredentialStatus, TagStatus } from "@/lib/db-types";
import { prisma } from "@/lib/prisma";
import type { WatchHistoryItemRecord } from "@/lib/store-types";
import { addDays } from "@/lib/utils";
import { ensureBiliCredential, getDecryptedCookie } from "@/lib/server/config";

const BILIBILI_HISTORY_API = "https://api.bilibili.com/x/web-interface/history/cursor";

type RawHistoryItem = Record<string, unknown> & {
  title?: string;
  author_name?: string;
  tag_name?: string;
  sub_tag_name?: string;
  covers?: string[];
  duration?: number;
  progress?: number;
  view_at?: number;
  business?: string;
  bvid?: string;
  aid?: number | string;
  history?: {
    oid?: number | string;
    bvid?: string;
    business?: string;
    view_at?: number;
    kid?: number | string;
  };
};

type CursorState = {
  max?: number;
  view_at?: number;
  business?: string;
};

type SyncOptions = {
  trigger: string;
  full?: boolean;
};

function parseCookie(cookie: string) {
  return Object.fromEntries(
    cookie
      .split(";")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const [key, ...rest] = entry.split("=");
        return [key, rest.join("=")];
      }),
  );
}

function normalizeHistoryItem(item: RawHistoryItem) {
  const viewAt = Number(item.view_at ?? item.history?.view_at ?? 0);
  const oid = String(item.history?.oid ?? item.aid ?? item.history?.kid ?? "");
  const bvid = item.bvid ?? item.history?.bvid ?? null;
  const business = item.history?.business ?? item.business ?? "archive";
  const aid = String(item.aid ?? item.history?.kid ?? "");
  const title = String(item.title ?? "未命名视频");

  const historyKey = `${business}:${oid || bvid || title}:${viewAt}`;

  return {
    historyKey,
    bvid,
    aid: aid || null,
    oid: oid || null,
    business,
    title,
    authorName: item.author_name ? String(item.author_name) : null,
    authorMid: null,
    tagName: item.tag_name ? String(item.tag_name) : null,
    subTagName: item.sub_tag_name ? String(item.sub_tag_name) : null,
    watchedAt: new Date(viewAt * 1000),
    duration: Number(item.duration ?? 0),
    progress: typeof item.progress === "number" ? item.progress : null,
    viewingAt: deriveViewingAt(viewAt),
    covers: JSON.stringify(item.covers ?? []),
    rawPayload: JSON.stringify(item),
  };
}

export function deriveViewingAt(timestamp: number) {
  const hour = new Date(timestamp * 1000).getHours();

  if (hour < 6) {
    return "凌晨";
  }
  if (hour < 12) {
    return "上午";
  }
  if (hour < 18) {
    return "下午";
  }
  return "晚间";
}

async function fetchHistoryPage(cookie: string, cursor?: CursorState) {
  const params = new URLSearchParams();

  if (cursor?.max) {
    params.set("max", String(cursor.max));
  }
  if (cursor?.view_at) {
    params.set("view_at", String(cursor.view_at));
  }
  if (cursor?.business) {
    params.set("business", cursor.business);
  }

  const response = await fetch(`${BILIBILI_HISTORY_API}?${params.toString()}`, {
    headers: {
      Cookie: cookie,
      Referer: "https://www.bilibili.com/",
      Origin: "https://www.bilibili.com",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
      Accept: "application/json, text/plain, */*",
    },
    cache: "no-store",
  });

  if (response.status === 412 || response.status === 401 || response.status === 403) {
    throw new Error("Bilibili 拒绝了请求，Cookie 可能失效或触发风控。");
  }

  if (!response.ok) {
    throw new Error(`Bilibili 接口异常: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as {
    code: number;
    message: string;
    data?: {
      list?: RawHistoryItem[];
      cursor?: CursorState;
    };
  };

  if (payload.code !== 0 || !payload.data) {
    throw new Error(payload.message || "Bilibili 历史接口返回异常。");
  }

  return {
    list: payload.data.list ?? [],
    cursor: payload.data.cursor,
  };
}

export async function syncWatchHistory(options: SyncOptions) {
  const credential = await ensureBiliCredential();
  const cookie = await getDecryptedCookie();

  if (!cookie) {
    throw new Error("请先在设置页配置 Bilibili Cookie。");
  }

  const parsedCookie = parseCookie(cookie);
  if (!parsedCookie.SESSDATA) {
    throw new Error("Cookie 缺少 SESSDATA，无法请求观看历史。");
  }

  let cursor: CursorState | undefined;
  let inserted = 0;
  let updated = 0;
  let pages = 0;
  let reachedCutoff = false;
  const cutoff = addDays(new Date(), -2);
  const maxPages = options.full ? 20 : 6;

  while (pages < maxPages && !reachedCutoff) {
    const page = await fetchHistoryPage(cookie, cursor);
    pages += 1;

    if (page.list.length === 0) {
      break;
    }

    for (const rawItem of page.list) {
      const item = normalizeHistoryItem(rawItem);

      if (!options.full && item.watchedAt < cutoff) {
        reachedCutoff = true;
        continue;
      }

      const result = (await prisma.watchHistoryItem.upsert({
        where: { historyKey: item.historyKey },
        update: {
          ...item,
          tagStatus: TagStatus.PENDING,
        },
        create: item,
      })) as WatchHistoryItemRecord & { __created?: boolean };

      if (result.__created) {
        inserted += 1;
      } else {
        updated += 1;
      }
    }

    cursor = page.cursor;

    if (!cursor?.max && !cursor?.view_at) {
      break;
    }
  }

  await prisma.biliCredential.update({
    where: { singleton: credential.singleton },
    data: {
      status: CredentialStatus.ACTIVE,
      lastValidatedAt: new Date(),
      failureReason: null,
    },
  });

  return {
    inserted,
    updated,
    pages,
    reachedCutoff,
  };
}

export async function markCredentialError(message: string) {
  await prisma.biliCredential.upsert({
    where: { singleton: "default" },
    update: {
      status: CredentialStatus.INVALID,
      failureReason: message,
    },
    create: {
      singleton: "default",
      status: CredentialStatus.INVALID,
      failureReason: message,
    },
  });
}
