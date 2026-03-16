import type { DistributionEntry, DailyBreakdown } from "@/lib/types";
import { describeDelta, percent, takeTopEntries } from "@/lib/utils";

type ScoreInput = {
  totalVideos: number;
  totalDurationMinutes: number;
  topicDistribution: DistributionEntry[];
  authorDistribution: DistributionEntry[];
  zoneDistribution: DistributionEntry[];
  activeHours: DistributionEntry[];
  noveltyRatio: number | null;
  previousScore?: number | null;
};

function shannonEntropy(distribution: DistributionEntry[]) {
  if (distribution.length <= 1) {
    return 0;
  }

  return distribution.reduce((sum, item) => {
    if (item.share === 0) {
      return sum;
    }
    return sum - item.share * Math.log2(item.share);
  }, 0);
}

function normalizeEntropy(distribution: DistributionEntry[]) {
  if (distribution.length <= 1) {
    return 0;
  }

  const entropy = shannonEntropy(distribution);
  return entropy / Math.log2(distribution.length);
}

export function computeCocoonScore(input: ScoreInput): DailyBreakdown {
  const sampleSize = input.totalVideos;
  const insufficientSample = sampleSize < 5;
  const normalizedEntropy = normalizeEntropy(input.topicDistribution);
  const topicNarrowness = 1 - normalizedEntropy;
  const categoryConcentration = takeTopEntries(input.zoneDistribution, 1)[0]?.share ?? 0;
  const authorRepetition = takeTopEntries(input.authorDistribution, 3).reduce(
    (sum, item) => sum + item.share,
    0,
  );
  const noveltyDrop = input.noveltyRatio == null ? 0.45 : 1 - input.noveltyRatio;
  const longestHourShare = takeTopEntries(input.activeHours, 1)[0]?.share ?? 0;
  const avgDuration = input.totalVideos > 0 ? input.totalDurationMinutes / input.totalVideos : 0;
  const sessionTunnel = Math.min(1, longestHourShare * 0.7 + Math.min(avgDuration / 30, 1) * 0.3);

  const score = Math.round(
    (topicNarrowness * 0.28 +
      categoryConcentration * 0.18 +
      authorRepetition * 0.22 +
      noveltyDrop * 0.18 +
      sessionTunnel * 0.14) *
      100,
  );

  const previousScore = input.previousScore ?? null;
  const delta = previousScore == null ? 0 : (score - previousScore) / 100;
  const comparisonLabel = previousScore == null ? "暂无前一日可对比" : describeDelta(delta);

  const level: "低" | "中" | "高" = score >= 68 ? "高" : score >= 35 ? "中" : "低";
  const evidence: string[] = [];

  if (insufficientSample) {
    evidence.push("今日样本不足 5 条，结论仅供参考。");
  }

  if (input.topicDistribution.length > 0) {
    const topTopic = takeTopEntries(input.topicDistribution, 1)[0];
    evidence.push(
      `主题集中度 ${percent(topicNarrowness)}，最常出现的是“${topTopic.label}”，占比 ${percent(topTopic.share)}。`,
    );
  }

  if (input.authorDistribution.length > 0) {
    evidence.push(`前 3 位 UP 主合计占比 ${percent(authorRepetition)}。`);
  }

  if (input.noveltyRatio != null) {
    evidence.push(`新主题/新 UP 主占比 ${percent(input.noveltyRatio)}。`);
  }

  evidence.push(`最集中的观看时段占比 ${percent(longestHourShare)}，平均单条时长 ${avgDuration.toFixed(1)} 分钟。`);

  return {
    sampleSize,
    topicEntropy: Number(normalizedEntropy.toFixed(4)),
    topicNarrowness: Number(topicNarrowness.toFixed(4)),
    categoryConcentration: Number(categoryConcentration.toFixed(4)),
    authorRepetition: Number(authorRepetition.toFixed(4)),
    noveltyDrop: Number(noveltyDrop.toFixed(4)),
    sessionTunnel: Number(sessionTunnel.toFixed(4)),
    score,
    level,
    comparisonLabel,
    evidence,
    insufficientSample,
  };
}
