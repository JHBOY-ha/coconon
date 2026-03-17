import { prisma } from "@/lib/prisma";
import type { ContentTagRecord, WatchHistoryItemRecord } from "@/lib/store-types";
import { deriveCanonicalTopics, normalizeTopicLabel } from "@/lib/topic-taxonomy";
import {
  addDays,
  endOfDay,
  estimateWatchedSeconds,
  formatDay,
  startOfDay,
} from "@/lib/utils";

type TrendDay = {
  dayKey: string;
  label: string;
  totalVideos: number;
  estimatedMinutes: number;
  topics: Array<{
    label: string;
    count: number;
    share: number;
  }>;
};

export type DailyTrendSummary = {
  days: TrendDay[];
  topicLegend: string[];
  totalVideos: number;
  totalMinutes: number;
  avgVideosPerDay: number;
  activeDays: number;
};

function getPrimaryTopic(item: WatchHistoryItemRecord & { contentTags: ContentTagRecord[] }) {
  const labels = item.contentTags
    .map((tag) => normalizeTopicLabel(tag.label))
    .filter((value): value is string => Boolean(value));

  if (labels.length > 0) {
    return labels[0];
  }

  return deriveCanonicalTopics(item)[0] ?? "未分类";
}

function buildTopicBreakdown(values: string[], legend: string[]) {
  if (values.length === 0) {
    return [];
  }

  const counts = new Map<string, number>();
  for (const value of values) {
    const bucket = legend.includes(value) ? value : "其他";
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, count]) => ({
      label,
      count,
      share: count / values.length,
    }))
    .sort((a, b) => b.count - a.count);
}

export async function getDailyTrendSummary(options?: { days?: number }): Promise<DailyTrendSummary> {
  const span = Math.max(7, Math.min(options?.days ?? 14, 60));
  const today = startOfDay(new Date());
  const start = startOfDay(addDays(today, -(span - 1)));
  const end = endOfDay(today);

  const items = (await prisma.watchHistoryItem.findMany({
    where: {
      watchedAt: {
        gte: start,
        lte: end,
      },
    },
    include: { contentTags: true },
    orderBy: { watchedAt: "asc" },
  })) as Array<WatchHistoryItemRecord & { contentTags: ContentTagRecord[] }>;

  const topicCounts = new Map<string, number>();
  const itemsByDay = new Map<string, Array<WatchHistoryItemRecord & { contentTags: ContentTagRecord[] }>>();

  for (const item of items) {
    const dayKey = formatDay(item.watchedAt);
    const topic = getPrimaryTopic(item);
    topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);

    const bucket = itemsByDay.get(dayKey);
    if (bucket) {
      bucket.push(item);
    } else {
      itemsByDay.set(dayKey, [item]);
    }
  }

  const topicLegend = [...topicCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label]) => label);

  const days: TrendDay[] = [];
  let totalVideos = 0;
  let totalMinutes = 0;

  for (let index = 0; index < span; index += 1) {
    const current = addDays(start, index);
    const dayKey = formatDay(current);
    const dayItems = itemsByDay.get(dayKey) ?? [];
    const estimatedMinutes = Math.round(
      dayItems.reduce((sum, item) => sum + estimateWatchedSeconds(item.duration, item.progress), 0) / 60,
    );
    const topics = buildTopicBreakdown(
      dayItems.map((item) => getPrimaryTopic(item)),
      topicLegend,
    );

    totalVideos += dayItems.length;
    totalMinutes += estimatedMinutes;

    days.push({
      dayKey,
      label: dayKey.slice(5),
      totalVideos: dayItems.length,
      estimatedMinutes,
      topics,
    });
  }

  const activeDays = days.filter((day) => day.totalVideos > 0).length;

  return {
    days,
    topicLegend: topicCounts.size > 6 ? [...topicLegend, "其他"] : topicLegend,
    totalVideos,
    totalMinutes,
    avgVideosPerDay: span === 0 ? 0 : Number((totalVideos / span).toFixed(1)),
    activeDays,
  };
}
