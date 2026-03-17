import { TagSource, TagStatus } from "@/lib/db-types";
import { prisma } from "@/lib/prisma";
import { computeCocononScore } from "@/lib/cocoon-score";
import { deriveCanonicalTopics, normalizeTopicLabel } from "@/lib/topic-taxonomy";
import type {
  ContentTagRecord,
  DailyReportRecord,
  DailySnapshotRecord,
  WatchHistoryItemRecord,
  WeeklyReportRecord,
  WeeklySnapshotRecord,
} from "@/lib/store-types";
import type {
  ComparisonBreakdown,
  ComparisonPeriod,
  DistributionEntry,
  ReportPromptPayload,
  TagJobProgress,
  TagQueueSummary,
  WindowSnapshot,
} from "@/lib/types";
import {
  addDays,
  endOfDay,
  endOfWeek,
  estimateWatchedSeconds,
  formatDay,
  formatDuration,
  formatWeekKey,
  parseDayKey,
  parseWeekKey,
  sanitizeContentLabel,
  sanitizeViewingAtLabel,
  startOfDay,
  startOfWeek,
  takeTopEntries,
  unique,
} from "@/lib/utils";
import { enrichTagsWithLlm, generateNarrativeReport } from "@/lib/server/llm";

const RULE_TAG_SECONDS = 0.25;
const LLM_TAG_SECONDS = 8;

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

function getEstimatedDurationMinutes(items: Array<{ duration: number; progress: number | null }>) {
  return Math.round(
    items.reduce((sum, item) => sum + estimateWatchedSeconds(item.duration, item.progress), 0) / 60,
  );
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

  for (const label of deriveCanonicalTopics(item)) {
    tags.add(label);
  }

  for (const [label, keywords] of keywordGroups) {
    if (keywords.some((keyword) => title.includes(keyword))) {
      tags.add(label);
    }
  }

  if (item.authorName?.includes("新闻") || title.includes("时政")) {
    tags.add("时事");
  }

  const viewingAtLabel = sanitizeViewingAtLabel(item.viewingAt);
  if (viewingAtLabel) {
    tags.add(`${viewingAtLabel}观看`);
  }

  return [...tags].slice(0, 4);
}

function getValidContentLabels(item: {
  contentTags?: Array<{ label: string }>;
  tagName?: string | null;
  subTagName?: string | null;
}) {
  const labels =
    item.contentTags
      ?.map((tag) => normalizeTopicLabel(tag.label) ?? sanitizeContentLabel(tag.label))
      .filter((value): value is string => Boolean(value)) ?? [];

  if (labels.length > 0) {
    return labels;
  }

  return [item.subTagName, item.tagName]
    .map((label) => normalizeTopicLabel(label) ?? sanitizeContentLabel(label))
    .filter((value): value is string => Boolean(value));
}

function getPrimaryTopicLabel(item: {
  contentTags?: Array<{ label: string }>;
  tagName?: string | null;
  subTagName?: string | null;
}) {
  return getValidContentLabels(item)[0] ?? "未分类";
}

function safeJson(value: unknown) {
  return JSON.stringify(value ?? null);
}

function parseDistribution(payload: string) {
  return (JSON.parse(payload) as DistributionEntry[]) ?? [];
}

function buildWindowLabel(period: ComparisonPeriod, start: Date, end: Date) {
  if (period === "daily") {
    return formatDay(start);
  }

  return `${formatDay(start)} 至 ${formatDay(end)}`;
}

function snapshotMetrics(snapshot: WindowSnapshot) {
  return {
    windowLabel: snapshot.label,
    totalVideos: snapshot.totalVideos,
    estimatedDuration: formatDuration(snapshot.totalDurationMinutes),
    avgDurationMinutes: snapshot.avgDurationMinutes,
    noveltyRatio: snapshot.noveltyRatio,
    topTopics: takeTopEntries(snapshot.topicDistribution, 3),
    topZones: takeTopEntries(snapshot.zoneDistribution, 3),
    topAuthors: takeTopEntries(snapshot.authorDistribution, 3),
  };
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

export async function getTagQueueSummary(options?: { maxItems?: number }): Promise<TagQueueSummary> {
  const items = (await prisma.watchHistoryItem.findMany({
    where: {
      tagStatus: {
        in: [TagStatus.PENDING, TagStatus.FAILED],
      },
    },
    orderBy: { watchedAt: "desc" },
    take: options?.maxItems,
  })) as WatchHistoryItemRecord[];

  let llmCandidates = 0;
  let ruleCandidates = 0;

  for (const item of items) {
    const ruleTags = deriveRuleTags(item);
    if (ruleTags.length >= 2) {
      ruleCandidates += 1;
    } else {
      llmCandidates += 1;
    }
  }

  return {
    totalPending: items.length,
    llmCandidates,
    ruleCandidates,
    estimatedSeconds: Math.ceil(ruleCandidates * RULE_TAG_SECONDS + llmCandidates * LLM_TAG_SECONDS),
  };
}

export async function tagPendingItems(options?: {
  batchSize?: number;
  maxItems?: number;
  summary?: TagQueueSummary;
  onProgress?: (progress: TagJobProgress) => Promise<void> | void;
}) {
  const batchSize = Math.max(1, options?.batchSize ?? 60);
  const maxItems = options?.maxItems;
  const summary =
    options?.summary ??
    (await getTagQueueSummary({
      maxItems,
    }));
  const total = maxItems == null ? summary.totalPending : Math.min(summary.totalPending, maxItems);
  let processed = 0;

  if (options?.onProgress) {
    await options.onProgress({
      ...summary,
      totalPending: total,
      processed: 0,
      remaining: total,
      percent: total === 0 ? 100 : 0,
      estimatedRemainingSeconds: total === 0 ? 0 : summary.estimatedSeconds,
    });
  }

  while (maxItems == null || processed < maxItems) {
    const take = maxItems == null ? batchSize : Math.min(batchSize, maxItems - processed);
    if (take <= 0) {
      break;
    }

    const items = (await prisma.watchHistoryItem.findMany({
      where: {
        tagStatus: {
          in: [TagStatus.PENDING, TagStatus.FAILED],
        },
      },
      orderBy: { watchedAt: "desc" },
      take,
    })) as WatchHistoryItemRecord[];

    if (items.length === 0) {
      break;
    }

    for (const item of items) {
      const ruleTags = deriveRuleTags(item);

      if (ruleTags.length >= 2) {
        await saveTags(item.id, ruleTags, TagSource.RULE, item.summary ?? undefined, TagStatus.RULE_ONLY);
        processed += 1;
      } else {
        try {
          const llmResult = await enrichTagsWithLlm(item);

          if (llmResult && llmResult.tags.length > 0) {
            const tags = unique([...ruleTags, ...llmResult.tags]).slice(0, 4);
            await saveTags(item.id, tags, TagSource.LLM, llmResult.summary, TagStatus.ENRICHED);
          } else {
            const fallback = unique(
              [...ruleTags, item.subTagName, item.tagName, "未分类"]
                .map((label) => sanitizeContentLabel(label))
                .filter((value): value is string => Boolean(value)),
            ).slice(0, 3);
            await saveTags(item.id, fallback, TagSource.FALLBACK, item.summary ?? undefined, TagStatus.RULE_ONLY);
          }
        } catch {
          const fallback = unique(
            [...ruleTags, item.subTagName, item.tagName, "未分类"]
              .map((label) => sanitizeContentLabel(label))
              .filter((value): value is string => Boolean(value)),
          ).slice(0, 3);
          await saveTags(item.id, fallback, TagSource.FALLBACK, item.summary ?? undefined, TagStatus.FAILED);
        }

        processed += 1;
      }

      if (options?.onProgress) {
        const remaining = Math.max(0, total - processed);
        await options.onProgress({
          ...summary,
          totalPending: total,
          processed,
          remaining,
          percent: total === 0 ? 100 : Math.round((processed / total) * 100),
          estimatedRemainingSeconds:
            total === 0 ? 0 : Math.max(0, Math.round(summary.estimatedSeconds * (remaining / Math.max(total, 1)))),
        });
      }
    }

    if (items.length < take) {
      break;
    }
  }

  const remaining = (await prisma.watchHistoryItem.findMany({
    where: {
      tagStatus: {
        in: [TagStatus.PENDING, TagStatus.FAILED],
      },
    },
    orderBy: { watchedAt: "desc" },
    take: 1,
  })).length;

  return { ...summary, totalPending: total, processed, remaining };
}

async function collectWindowSnapshot(input: {
  period: ComparisonPeriod;
  key: string;
  currentStart: Date;
  currentEnd: Date;
  previousStart: Date;
  previousEnd: Date;
}) {
  const [items, previousItems] = await Promise.all([
    prisma.watchHistoryItem.findMany({
      where: {
        watchedAt: {
          gte: input.currentStart,
          lte: input.currentEnd,
        },
      },
      include: { contentTags: true },
      orderBy: { watchedAt: "asc" },
    }) as Promise<Array<WatchHistoryItemRecord & { contentTags: ContentTagRecord[] }>>,
    prisma.watchHistoryItem.findMany({
      where: {
        watchedAt: {
          gte: input.previousStart,
          lte: input.previousEnd,
        },
      },
      include: { contentTags: true },
      orderBy: { watchedAt: "asc" },
    }) as Promise<Array<WatchHistoryItemRecord & { contentTags: ContentTagRecord[] }>>,
  ]);

  const topicDistribution = buildDistribution(items.map((item) => getPrimaryTopicLabel(item)));
  const zoneDistribution = buildDistribution(items.map((item) => item.tagName || "未分区"));
  const authorDistribution = buildDistribution(items.map((item) => item.authorName || "未知 UP 主"));
  const activeHours = buildDistribution(items.map((item) => sanitizeViewingAtLabel(item.viewingAt) || "未知时段"));
  const previousTopics = new Set(previousItems.map((item) => getPrimaryTopicLabel(item)));
  const previousAuthors = new Set(previousItems.map((item) => item.authorName || "未知 UP 主"));

  const noveltySignals: number[] = items.map((item) => {
    const topic = getPrimaryTopicLabel(item);
    const author = item.authorName || "未知 UP 主";
    return !previousTopics.has(topic) || !previousAuthors.has(author) ? 1 : 0;
  });

  const totalDurationMinutes = getEstimatedDurationMinutes(items);
  const noveltyRatio =
    items.length === 0
      ? null
      : noveltySignals.reduce((sum, current) => sum + current, 0) / noveltySignals.length;

  const snapshot: WindowSnapshot = {
    key: input.key,
    label: buildWindowLabel(input.period, input.currentStart, input.currentEnd),
    start: input.currentStart.toISOString(),
    end: input.currentEnd.toISOString(),
    totalVideos: items.length,
    totalDurationMinutes,
    avgDurationMinutes: items.length === 0 ? 0 : Number((totalDurationMinutes / items.length).toFixed(1)),
    noveltyRatio,
    topicDistribution,
    zoneDistribution,
    authorDistribution,
    activeHours,
    uniqueAuthors: unique(items.map((item) => item.authorName || "未知 UP 主")).length,
    uniqueTopics: unique(items.map((item) => getPrimaryTopicLabel(item))).length,
  };

  return snapshot;
}

async function buildDailySnapshot(dayKey: string) {
  const currentStart = startOfDay(parseDayKey(dayKey));
  const currentEnd = endOfDay(currentStart);
  const previousStart = startOfDay(addDays(currentStart, -1));
  const previousEnd = endOfDay(previousStart);
  const snapshot = await collectWindowSnapshot({
    period: "daily",
    key: dayKey,
    currentStart,
    currentEnd,
    previousStart,
    previousEnd,
  });

  return (await prisma.dailySnapshot.upsert({
    where: { date: currentStart },
    update: {
      windowStart: currentStart,
      windowEnd: currentEnd,
      totalVideos: snapshot.totalVideos,
      totalDuration: snapshot.totalDurationMinutes,
      avgDuration: snapshot.avgDurationMinutes,
      uniqueAuthors: snapshot.uniqueAuthors,
      uniqueTopics: snapshot.uniqueTopics,
      activeHours: safeJson(snapshot.activeHours),
      topicDistribution: safeJson(snapshot.topicDistribution),
      zoneDistribution: safeJson(snapshot.zoneDistribution),
      authorDistribution: safeJson(snapshot.authorDistribution),
      noveltyRatio: snapshot.noveltyRatio,
      metrics: safeJson(snapshotMetrics(snapshot)),
    },
    create: {
      date: currentStart,
      windowStart: currentStart,
      windowEnd: currentEnd,
      totalVideos: snapshot.totalVideos,
      totalDuration: snapshot.totalDurationMinutes,
      avgDuration: snapshot.avgDurationMinutes,
      uniqueAuthors: snapshot.uniqueAuthors,
      uniqueTopics: snapshot.uniqueTopics,
      activeHours: safeJson(snapshot.activeHours),
      topicDistribution: safeJson(snapshot.topicDistribution),
      zoneDistribution: safeJson(snapshot.zoneDistribution),
      authorDistribution: safeJson(snapshot.authorDistribution),
      noveltyRatio: snapshot.noveltyRatio,
      metrics: safeJson(snapshotMetrics(snapshot)),
    },
  })) as DailySnapshotRecord;
}

async function buildWeeklySnapshot(weekKey: string) {
  const currentStart = startOfWeek(parseWeekKey(weekKey));
  const currentEnd = endOfWeek(currentStart);
  const previousStart = startOfWeek(addDays(currentStart, -7));
  const previousEnd = endOfWeek(previousStart);
  const snapshot = await collectWindowSnapshot({
    period: "weekly",
    key: weekKey,
    currentStart,
    currentEnd,
    previousStart,
    previousEnd,
  });

  return (await prisma.weeklySnapshot.upsert({
    where: { weekKey },
    update: {
      windowStart: currentStart,
      windowEnd: currentEnd,
      totalVideos: snapshot.totalVideos,
      totalDuration: snapshot.totalDurationMinutes,
      avgDuration: snapshot.avgDurationMinutes,
      uniqueAuthors: snapshot.uniqueAuthors,
      uniqueTopics: snapshot.uniqueTopics,
      activeHours: safeJson(snapshot.activeHours),
      topicDistribution: safeJson(snapshot.topicDistribution),
      zoneDistribution: safeJson(snapshot.zoneDistribution),
      authorDistribution: safeJson(snapshot.authorDistribution),
      noveltyRatio: snapshot.noveltyRatio,
      metrics: safeJson(snapshotMetrics(snapshot)),
    },
    create: {
      weekKey,
      windowStart: currentStart,
      windowEnd: currentEnd,
      totalVideos: snapshot.totalVideos,
      totalDuration: snapshot.totalDurationMinutes,
      avgDuration: snapshot.avgDurationMinutes,
      uniqueAuthors: snapshot.uniqueAuthors,
      uniqueTopics: snapshot.uniqueTopics,
      activeHours: safeJson(snapshot.activeHours),
      topicDistribution: safeJson(snapshot.topicDistribution),
      zoneDistribution: safeJson(snapshot.zoneDistribution),
      authorDistribution: safeJson(snapshot.authorDistribution),
      noveltyRatio: snapshot.noveltyRatio,
      metrics: safeJson(snapshotMetrics(snapshot)),
    },
  })) as WeeklySnapshotRecord;
}

function hydrateDailySnapshot(record: DailySnapshotRecord): WindowSnapshot {
  return {
    key: formatDay(record.date),
    label: buildWindowLabel("daily", record.windowStart, record.windowEnd),
    start: record.windowStart.toISOString(),
    end: record.windowEnd.toISOString(),
    totalVideos: record.totalVideos,
    totalDurationMinutes: record.totalDuration,
    avgDurationMinutes: record.avgDuration,
    noveltyRatio: record.noveltyRatio,
    topicDistribution: parseDistribution(record.topicDistribution),
    zoneDistribution: parseDistribution(record.zoneDistribution),
    authorDistribution: parseDistribution(record.authorDistribution),
    activeHours: parseDistribution(record.activeHours),
    uniqueAuthors: record.uniqueAuthors,
    uniqueTopics: record.uniqueTopics,
  };
}

function hydrateWeeklySnapshot(record: WeeklySnapshotRecord): WindowSnapshot {
  return {
    key: record.weekKey,
    label: buildWindowLabel("weekly", record.windowStart, record.windowEnd),
    start: record.windowStart.toISOString(),
    end: record.windowEnd.toISOString(),
    totalVideos: record.totalVideos,
    totalDurationMinutes: record.totalDuration,
    avgDurationMinutes: record.avgDuration,
    noveltyRatio: record.noveltyRatio,
    topicDistribution: parseDistribution(record.topicDistribution),
    zoneDistribution: parseDistribution(record.zoneDistribution),
    authorDistribution: parseDistribution(record.authorDistribution),
    activeHours: parseDistribution(record.activeHours),
    uniqueAuthors: record.uniqueAuthors,
    uniqueTopics: record.uniqueTopics,
  };
}

function buildFallbackBody(payload: ReportPromptPayload) {
  const prefix = payload.period === "daily" ? "今天相对昨天" : "本周相对上周";

  return {
    summary: payload.sampleSufficient
      ? `${prefix}${payload.comparisonLabel}。`
      : `${prefix}样本不足，暂不输出 coconon score。`,
    body: [
      `## 总结`,
      payload.sampleSufficient
        ? `${payload.windowLabel}的整体判断为**${payload.comparisonLabel}**。${payload.score != null ? `当前 coconon score 为 **${payload.score}**。` : ""}`
        : `${payload.windowLabel}与${payload.previousWindowLabel}的样本不足，暂不输出总分。`,
      `## 当前窗口`,
      `- 视频条数：${payload.current.totalVideos}`,
      `- 估算观看时长：${formatDuration(payload.current.totalDurationMinutes)}`,
      `- 平均单条时长：${payload.current.avgDurationMinutes.toFixed(1)} 分钟`,
      `## 对比证据`,
      ...payload.evidence.map((entry) => `- ${entry}`),
    ].join("\n"),
  };
}

async function buildReportNarrative(payload: ReportPromptPayload) {
  let generated: { summary: string; body: string } | null = null;

  try {
    generated = await generateNarrativeReport(payload);
  } catch (error) {
    console.error("Failed to generate comparison report with LLM, falling back to template.", error);
  }

  return generated ?? buildFallbackBody(payload);
}

async function generateDailyComparisonReport(dayKey = formatDay(new Date())) {
  const todayDate = parseDayKey(dayKey);
  const yesterdayDate = parseDayKey(formatDay(addDays(todayDate, -1)));
  const [currentRecord, previousRecord] = await Promise.all([
    buildDailySnapshot(dayKey),
    buildDailySnapshot(formatDay(yesterdayDate)),
  ]);

  const current = hydrateDailySnapshot(currentRecord);
  const previous = hydrateDailySnapshot(previousRecord);
  const breakdown = computeCocononScore({
    period: "daily",
    current,
    previous,
  });
  const payload: ReportPromptPayload = {
    period: "daily",
    windowLabel: current.label,
    previousWindowLabel: previous.label,
    score: breakdown.score,
    level: breakdown.level,
    comparisonLabel: breakdown.comparisonLabel,
    sampleSufficient: breakdown.sampleSufficient,
    current,
    previous,
    dimensions: breakdown.dimensions,
    evidence: breakdown.evidence,
  };
  const finalReport = await buildReportNarrative(payload);

  return (await prisma.dailyReport.upsert({
    where: { date: todayDate },
    update: {
      summary: finalReport.summary,
      body: finalReport.body,
      cocononScore: breakdown.score,
      cocononLevel: breakdown.level,
      comparisonLabel: breakdown.comparisonLabel,
      comparisonTarget: previous.label,
      comparisonBreakdown: safeJson(breakdown),
      evidence: safeJson(breakdown.evidence),
      metrics: safeJson({
        current: snapshotMetrics(current),
        previous: snapshotMetrics(previous),
      }),
      sampleSufficient: breakdown.sampleSufficient ? 1 : 0,
    },
    create: {
      date: todayDate,
      summary: finalReport.summary,
      body: finalReport.body,
      cocononScore: breakdown.score,
      cocononLevel: breakdown.level,
      comparisonLabel: breakdown.comparisonLabel,
      comparisonTarget: previous.label,
      comparisonBreakdown: safeJson(breakdown),
      evidence: safeJson(breakdown.evidence),
      metrics: safeJson({
        current: snapshotMetrics(current),
        previous: snapshotMetrics(previous),
      }),
      sampleSufficient: breakdown.sampleSufficient ? 1 : 0,
    },
  })) as DailyReportRecord;
}

async function generateWeeklyComparisonReport(weekKey = formatWeekKey(new Date())) {
  const currentWeek = parseWeekKey(weekKey);
  const previousWeekKey = formatWeekKey(addDays(currentWeek, -7));
  const [currentRecord, previousRecord] = await Promise.all([
    buildWeeklySnapshot(weekKey),
    buildWeeklySnapshot(previousWeekKey),
  ]);

  const current = hydrateWeeklySnapshot(currentRecord);
  const previous = hydrateWeeklySnapshot(previousRecord);
  const breakdown = computeCocononScore({
    period: "weekly",
    current,
    previous,
  });
  const payload: ReportPromptPayload = {
    period: "weekly",
    windowLabel: current.label,
    previousWindowLabel: previous.label,
    score: breakdown.score,
    level: breakdown.level,
    comparisonLabel: breakdown.comparisonLabel,
    sampleSufficient: breakdown.sampleSufficient,
    current,
    previous,
    dimensions: breakdown.dimensions,
    evidence: breakdown.evidence,
  };
  const finalReport = await buildReportNarrative(payload);

  return (await prisma.weeklyReport.upsert({
    where: { weekKey },
    update: {
      windowStart: parseWeekKey(weekKey),
      windowEnd: endOfWeek(parseWeekKey(weekKey)),
      summary: finalReport.summary,
      body: finalReport.body,
      cocononScore: breakdown.score,
      cocononLevel: breakdown.level,
      comparisonLabel: breakdown.comparisonLabel,
      comparisonTarget: previous.label,
      comparisonBreakdown: safeJson(breakdown),
      evidence: safeJson(breakdown.evidence),
      metrics: safeJson({
        current: snapshotMetrics(current),
        previous: snapshotMetrics(previous),
      }),
      sampleSufficient: breakdown.sampleSufficient ? 1 : 0,
    },
    create: {
      weekKey,
      windowStart: parseWeekKey(weekKey),
      windowEnd: endOfWeek(parseWeekKey(weekKey)),
      summary: finalReport.summary,
      body: finalReport.body,
      cocononScore: breakdown.score,
      cocononLevel: breakdown.level,
      comparisonLabel: breakdown.comparisonLabel,
      comparisonTarget: previous.label,
      comparisonBreakdown: safeJson(breakdown),
      evidence: safeJson(breakdown.evidence),
      metrics: safeJson({
        current: snapshotMetrics(current),
        previous: snapshotMetrics(previous),
      }),
      sampleSufficient: breakdown.sampleSufficient ? 1 : 0,
    },
  })) as WeeklyReportRecord;
}

export async function generateDailyReport(dayKey = formatDay(new Date())) {
  return generateDailyComparisonReport(dayKey);
}

export async function generateWeeklyReport(weekKey = formatWeekKey(new Date())) {
  return generateWeeklyComparisonReport(weekKey);
}

export async function generateReports(options?: {
  period?: "daily" | "weekly" | "both";
  dayKey?: string;
  weekKey?: string;
}) {
  const period = options?.period ?? "daily";

  if (period === "daily") {
    return {
      daily: await generateDailyComparisonReport(options?.dayKey ?? formatDay(new Date())),
      weekly: null,
    };
  }

  if (period === "weekly") {
    return {
      daily: null,
      weekly: await generateWeeklyComparisonReport(options?.weekKey ?? formatWeekKey(new Date())),
    };
  }

  const [daily, weekly] = await Promise.all([
    generateDailyComparisonReport(options?.dayKey ?? formatDay(new Date())),
    generateWeeklyComparisonReport(options?.weekKey ?? formatWeekKey(new Date())),
  ]);

  return { daily, weekly };
}

export function parseComparisonBreakdown(payload: string) {
  return JSON.parse(payload) as ComparisonBreakdown;
}
