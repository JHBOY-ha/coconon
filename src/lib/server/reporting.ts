import { TagSource, TagStatus } from "@/lib/db-types";
import { prisma } from "@/lib/prisma";
import { computeCocoonScore } from "@/lib/cocoon-score";
import type { ContentTagRecord, DailyReportRecord, DailySnapshotRecord, WatchHistoryItemRecord } from "@/lib/store-types";
import type { DistributionEntry, ReportPromptPayload } from "@/lib/types";
import {
  addDays,
  endOfDay,
  formatDay,
  formatDuration,
  parseDayKey,
  percent,
  startOfDay,
  takeTopEntries,
  unique,
} from "@/lib/utils";
import { enrichTagsWithLlm, generateNarrativeReport } from "@/lib/server/llm";

function buildDistribution(values: string[]) {
  const total = values.length;
  const map = new Map<string, number>();

  for (const value of values) {
    map.set(value, (map.get(value) ?? 0) + 1);
  }

  return [...map.entries()]
    .map(([label, count]) => ({
      label,
      count,
      share: total === 0 ? 0 : count / total,
    }))
    .sort((a, b) => b.count - a.count);
}

function deriveRuleTags(item: {
  title: string;
  tagName: string | null;
  subTagName: string | null;
  authorName: string | null;
  viewingAt: string | null;
}) {
  const tags = new Set<string>();
  const title = item.title.toLowerCase();

  const keywordGroups: Array<[string, string[]]> = [
    ["游戏", ["游戏", "实况", "攻略", "电竞", "steam", "switch"]],
    ["科技", ["ai", "开源", "芯片", "编程", "技术", "数码"]],
    ["知识", ["历史", "数学", "科普", "经济", "哲学", "心理"]],
    ["娱乐", ["综艺", "reaction", "搞笑", "整活"]],
    ["影视", ["电影", "电视剧", "解说", "剪辑"]],
    ["动漫", ["动画", "番剧", "二次元", "vtuber"]],
    ["音乐", ["翻唱", "演奏", "live", "mv", "音乐"]],
    ["生活", ["vlog", "日常", "探店", "旅行", "收纳"]],
    ["美食", ["做饭", "料理", "探店", "美食"]],
  ];

  if (item.tagName) {
    tags.add(item.tagName);
  }
  if (item.subTagName) {
    tags.add(item.subTagName);
  }

  for (const [label, keywords] of keywordGroups) {
    if (keywords.some((keyword) => title.includes(keyword))) {
      tags.add(label);
    }
  }

  if (item.authorName?.includes("新闻") || title.includes("时政")) {
    tags.add("时事");
  }

  if (item.viewingAt) {
    tags.add(`${item.viewingAt}观看`);
  }

  return [...tags].slice(0, 4);
}

function safeJson(value: unknown) {
  return JSON.stringify(value ?? null);
}

async function saveTags(
  itemId: string,
  tags: string[],
  source: TagSource,
  summary?: string,
  status: TagStatus = TagStatus.ENRICHED,
) {
  await prisma.contentTag.deleteMany({ where: { watchHistoryItemId: itemId } });
  await prisma.contentTag.createMany({
    data: tags.map((label) => ({
      watchHistoryItemId: itemId,
      label,
      source,
      summary,
      confidence: source === TagSource.LLM ? 0.72 : 0.9,
    })),
  });
  await prisma.watchHistoryItem.update({
    where: { id: itemId },
    data: {
      summary,
      tagStatus: status,
    },
  });
}

export async function tagPendingItems(limit = 60) {
  const items = (await prisma.watchHistoryItem.findMany({
    where: {
      tagStatus: {
        in: [TagStatus.PENDING, TagStatus.FAILED],
      },
    },
    orderBy: { watchedAt: "desc" },
    take: limit,
  })) as WatchHistoryItemRecord[];

  let processed = 0;

  for (const item of items) {
    const ruleTags = deriveRuleTags(item);

    if (ruleTags.length >= 2) {
      await saveTags(item.id, ruleTags, TagSource.RULE, item.summary ?? undefined, TagStatus.RULE_ONLY);
      processed += 1;
      continue;
    }

    try {
      const llmResult = await enrichTagsWithLlm(item);

      if (llmResult && llmResult.tags.length > 0) {
        const tags = unique([...ruleTags, ...llmResult.tags]).slice(0, 4);
        await saveTags(item.id, tags, TagSource.LLM, llmResult.summary, TagStatus.ENRICHED);
      } else {
        const fallback = unique([...ruleTags, item.tagName ?? "未分类"]).slice(0, 3);
        await saveTags(item.id, fallback, TagSource.FALLBACK, item.summary ?? undefined, TagStatus.RULE_ONLY);
      }
    } catch {
      const fallback = unique([...ruleTags, item.tagName ?? "未分类"]).slice(0, 3);
      await saveTags(item.id, fallback, TagSource.FALLBACK, item.summary ?? undefined, TagStatus.FAILED);
    }

    processed += 1;
  }

  return { processed };
}

async function buildSnapshotForDay(dayKey: string): Promise<DailySnapshotRecord> {
  const date = parseDayKey(dayKey);
  const items = (await prisma.watchHistoryItem.findMany({
    where: {
      watchedAt: {
        gte: startOfDay(date),
        lte: endOfDay(date),
      },
    },
    include: {
      contentTags: true,
    },
    orderBy: { watchedAt: "asc" },
  })) as Array<WatchHistoryItemRecord & { contentTags: ContentTagRecord[] }>;

  if (items.length === 0) {
    return (await prisma.dailySnapshot.upsert({
      where: { date },
      update: {
        totalVideos: 0,
        totalDuration: 0,
        uniqueAuthors: 0,
        uniqueTopics: 0,
        activeHours: safeJson([]),
        topicDistribution: safeJson([]),
        zoneDistribution: safeJson([]),
        authorDistribution: safeJson([]),
        noveltyRatio: null,
        scoreBreakdown: safeJson({}),
      },
      create: {
        date,
        totalVideos: 0,
        totalDuration: 0,
        uniqueAuthors: 0,
        uniqueTopics: 0,
        activeHours: safeJson([]),
        topicDistribution: safeJson([]),
        zoneDistribution: safeJson([]),
        authorDistribution: safeJson([]),
        noveltyRatio: null,
        scoreBreakdown: safeJson({}),
      },
    })) as DailySnapshotRecord;
  }

  const authorDistribution = buildDistribution(items.map((item) => item.authorName || "未知 UP 主"));
  const zoneDistribution = buildDistribution(items.map((item) => item.tagName || "未分区"));
  const activeHours = buildDistribution(items.map((item) => item.viewingAt || "未知时段"));
  const topicDistribution = buildDistribution(
    items.map((item) => item.contentTags[0]?.label || item.tagName || item.subTagName || "未分类"),
  );

  const previousDay = addDays(date, -1);
  const previousItems = (await prisma.watchHistoryItem.findMany({
    where: {
      watchedAt: {
        gte: startOfDay(previousDay),
        lte: endOfDay(previousDay),
      },
    },
    include: {
      contentTags: true,
    },
  })) as Array<WatchHistoryItemRecord & { contentTags: ContentTagRecord[] }>;

  const previousTopics = new Set(
    previousItems.map((item) => item.contentTags[0]?.label || item.tagName || item.subTagName || "未分类"),
  );
  const previousAuthors = new Set(previousItems.map((item) => item.authorName || "未知 UP 主"));

  const noveltySignals = items.map((item) => {
    const topic = item.contentTags[0]?.label || item.tagName || item.subTagName || "未分类";
    const author = item.authorName || "未知 UP 主";
    const isNewTopic = !previousTopics.has(topic);
    const isNewAuthor = !previousAuthors.has(author);
    return isNewTopic || isNewAuthor ? 1 : 0;
  });

  const noveltyRatio =
    noveltySignals.length === 0
      ? null
      : noveltySignals.reduce((sum: number, current: number) => sum + current, 0) / noveltySignals.length;

  return (await prisma.dailySnapshot.upsert({
    where: { date },
    update: {
      totalVideos: items.length,
      totalDuration: items.reduce((sum: number, item) => sum + item.duration, 0),
      uniqueAuthors: unique(items.map((item) => item.authorName || "未知 UP 主")).length,
      uniqueTopics: unique(
        items.map((item) => item.contentTags[0]?.label || item.tagName || item.subTagName || "未分类"),
      ).length,
      activeHours: safeJson(activeHours),
      topicDistribution: safeJson(topicDistribution),
      zoneDistribution: safeJson(zoneDistribution),
      authorDistribution: safeJson(authorDistribution),
      noveltyRatio,
      scoreBreakdown: safeJson({}),
    },
    create: {
      date,
      totalVideos: items.length,
      totalDuration: items.reduce((sum: number, item) => sum + item.duration, 0),
      uniqueAuthors: unique(items.map((item) => item.authorName || "未知 UP 主")).length,
      uniqueTopics: unique(
        items.map((item) => item.contentTags[0]?.label || item.tagName || item.subTagName || "未分类"),
      ).length,
      activeHours: safeJson(activeHours),
      topicDistribution: safeJson(topicDistribution),
      zoneDistribution: safeJson(zoneDistribution),
      authorDistribution: safeJson(authorDistribution),
      noveltyRatio,
      scoreBreakdown: safeJson({}),
    },
  })) as DailySnapshotRecord;
}

function parseDistribution(payload: string): DistributionEntry[] {
  return (JSON.parse(payload) as DistributionEntry[]) ?? [];
}

function buildFallbackBody(payload: ReportPromptPayload) {
  const topicLabels = payload.topTopics.map((item: DistributionEntry) => item.label).join("、") || "暂无明显主题";
  const authorLabels =
    payload.topAuthors.map((item: DistributionEntry) => item.label).join("、") || "暂无明显集中 UP 主";
  const novelty = payload.noveltyRatio == null ? "样本不足，暂不判断新颖度。" : `新颖度 ${percent(payload.noveltyRatio)}。`;

  return {
    summary: `今天的内容摄入${payload.comparisonLabel}，信息茧房风险为 ${payload.cocoonLevel}（${payload.cocoonScore} 分）。`,
    body: [
      `你今天一共看了 ${payload.totalVideos} 条视频，累计约 ${payload.totalDurationMinutes} 分钟。`,
      `内容主要集中在 ${topicLabels}；最常观看的 UP 主包括 ${authorLabels}。`,
      novelty,
      `综合来看，系统判断你今天的内容结构${payload.comparisonLabel}。`,
      `证据：${payload.evidence.join(" ")}`,
    ].join("\n\n"),
  };
}

export async function generateDailyReport(dayKey = formatDay(new Date())): Promise<DailyReportRecord> {
  const todaySnapshot = (await buildSnapshotForDay(dayKey)) as DailySnapshotRecord;
  const previousDayKey = formatDay(addDays(parseDayKey(dayKey), -1));
  const previousDate = parseDayKey(previousDayKey);
  const previousReport = (await prisma.dailyReport.findUnique({
    where: { date: previousDate },
  })) as DailyReportRecord | null;

  const breakdown = computeCocoonScore({
    totalVideos: todaySnapshot.totalVideos,
    totalDurationMinutes: Math.round(todaySnapshot.totalDuration / 60),
    topicDistribution: parseDistribution(todaySnapshot.topicDistribution),
    authorDistribution: parseDistribution(todaySnapshot.authorDistribution),
    zoneDistribution: parseDistribution(todaySnapshot.zoneDistribution),
    activeHours: parseDistribution(todaySnapshot.activeHours),
    noveltyRatio: todaySnapshot.noveltyRatio,
    previousScore: previousReport?.cocoonScore,
  });

  await prisma.dailySnapshot.update({
    where: { date: todaySnapshot.date },
    data: {
      scoreBreakdown: safeJson(breakdown),
    },
  });

  const payload: ReportPromptPayload = {
    dayKey,
    previousDayKey: previousReport ? previousDayKey : undefined,
    totalVideos: todaySnapshot.totalVideos,
    totalDurationMinutes: Math.round(todaySnapshot.totalDuration / 60),
    topTopics: takeTopEntries(parseDistribution(todaySnapshot.topicDistribution), 3),
    topAuthors: takeTopEntries(parseDistribution(todaySnapshot.authorDistribution), 3),
    topZones: takeTopEntries(parseDistribution(todaySnapshot.zoneDistribution), 3),
    noveltyRatio: todaySnapshot.noveltyRatio,
    cocoonScore: breakdown.score,
    cocoonLevel: breakdown.level,
    comparisonLabel: breakdown.comparisonLabel,
    evidence: breakdown.evidence,
  };

  const generated = (await generateNarrativeReport(payload)) ?? buildFallbackBody(payload);

  return (await prisma.dailyReport.upsert({
    where: { date: todaySnapshot.date },
    update: {
      summary: generated.summary,
      body: generated.body,
      cocoonScore: breakdown.score,
      cocoonLevel: breakdown.level,
      comparisonLabel: breakdown.comparisonLabel,
      evidence: safeJson(breakdown.evidence),
      metrics: safeJson({
        totalVideos: todaySnapshot.totalVideos,
        totalDuration: formatDuration(Math.round(todaySnapshot.totalDuration / 60)),
        noveltyRatio: todaySnapshot.noveltyRatio,
        scoreBreakdown: breakdown,
      }),
    },
    create: {
      date: todaySnapshot.date,
      summary: generated.summary,
      body: generated.body,
      cocoonScore: breakdown.score,
      cocoonLevel: breakdown.level,
      comparisonLabel: breakdown.comparisonLabel,
      evidence: safeJson(breakdown.evidence),
      metrics: safeJson({
        totalVideos: todaySnapshot.totalVideos,
        totalDuration: formatDuration(Math.round(todaySnapshot.totalDuration / 60)),
        noveltyRatio: todaySnapshot.noveltyRatio,
        scoreBreakdown: breakdown,
      }),
    },
  })) as DailyReportRecord;
}
