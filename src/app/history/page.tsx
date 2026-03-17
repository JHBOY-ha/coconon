import { AppShell } from "@/components/app-shell";
import { Panel } from "@/components/panel";
import { prisma } from "@/lib/prisma";
import type { ContentTagRecord, WatchHistoryItemRecord } from "@/lib/store-types";
import {
  endOfDay,
  estimateWatchedSeconds,
  formatDateTime,
  formatMinutesFromSeconds,
  sanitizeContentLabel,
  startOfDay,
} from "@/lib/utils";

export default async function TodayHistoryPage() {
  const today = new Date();
  const items = (await prisma.watchHistoryItem.findMany({
    where: {
      watchedAt: {
        gte: startOfDay(today),
        lte: endOfDay(today),
      },
    },
    include: {
      contentTags: true,
    },
    orderBy: { watchedAt: "desc" },
  })) as Array<WatchHistoryItemRecord & { contentTags: ContentTagRecord[] }>;

  const estimatedSeconds = items.reduce(
    (sum, item) => sum + estimateWatchedSeconds(item.duration, item.progress),
    0,
  );

  return (
    <AppShell currentPath="/history">
      <div className="space-y-6">
        <Panel>
          <p className="text-sm uppercase tracking-[0.25em] text-stone-500">Today history</p>
          <h2 className="mt-3 font-serif text-4xl text-stone-950">今日观看历史预览</h2>
          <p className="mt-4 max-w-3xl text-base leading-8 text-stone-600">
            用来核对今日同步结果。这里显示观看时间、UP 主、主题标签，以及按 `progress` 估算的观看时长。
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl bg-stone-100/80 p-4">
              <p className="text-sm text-stone-500">今日记录数</p>
              <p className="mt-2 text-2xl text-stone-950">{items.length}</p>
            </div>
            <div className="rounded-3xl bg-stone-100/80 p-4">
              <p className="text-sm text-stone-500">估算观看时长</p>
              <p className="mt-2 text-2xl text-stone-950">{formatMinutesFromSeconds(estimatedSeconds)}</p>
            </div>
            <div className="rounded-3xl bg-stone-100/80 p-4">
              <p className="text-sm text-stone-500">说明</p>
              <p className="mt-2 text-sm leading-6 text-stone-600">`-1` 按完整观看处理，其他情况优先用 `progress` 估算。</p>
            </div>
          </div>
        </Panel>

        <Panel>
          <div className="space-y-4">
            {items.length > 0 ? (
              items.map((item) => {
                const estimated = estimateWatchedSeconds(item.duration, item.progress);
                const labels =
                  item.contentTags.length > 0
                    ? item.contentTags
                        .map((tag) => sanitizeContentLabel(tag.label))
                        .filter((value): value is string => Boolean(value))
                        .slice(0, 4)
                    : [item.subTagName, item.tagName]
                        .map((label) => sanitizeContentLabel(label))
                        .filter((value): value is string => Boolean(value))
                        .slice(0, 2);

                return (
                  <article
                    key={item.id}
                    className="rounded-[1.75rem] border border-stone-200 bg-stone-50/80 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs uppercase tracking-[0.25em] text-stone-500">
                          {formatDateTime(item.watchedAt)}
                        </p>
                        <h3 className="mt-2 text-lg leading-8 text-stone-950">{item.title}</h3>
                        <p className="mt-2 text-sm text-stone-600">
                          {item.authorName || "未知 UP 主"} · {item.tagName || "未分区"}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {labels.length > 0 ? (
                            labels.map((label) => (
                              <span
                                key={label}
                                className="rounded-full bg-stone-900 px-3 py-1 text-xs text-stone-50"
                              >
                                {label}
                              </span>
                            ))
                          ) : (
                            <span className="rounded-full bg-stone-200 px-3 py-1 text-xs text-stone-600">
                              暂无标签
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="rounded-3xl bg-white px-4 py-3 text-right">
                        <p className="text-sm text-stone-500">估算观看</p>
                        <p className="mt-1 text-lg text-stone-950">{formatMinutesFromSeconds(estimated)}</p>
                        <p className="mt-1 text-xs text-stone-500">
                          progress {item.progress ?? "--"} / duration {item.duration}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="rounded-[1.75rem] border border-dashed border-stone-300 p-6 text-sm leading-7 text-stone-600">
                今天还没有同步到观看历史。先返回首页执行一次同步。
              </div>
            )}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
