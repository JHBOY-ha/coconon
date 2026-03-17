import type { ComparisonBreakdown, ComparisonDimension, ComparisonPeriod, DistributionEntry, WindowSummary } from "@/lib/types";
import { percent, signedPercent, takeTopEntries } from "@/lib/utils";

type ScoreInput = {
  period: ComparisonPeriod;
  current: WindowSummary;
  previous: WindowSummary;
};

const SCORE_WEIGHTS = {
  topic: 0.3,
  zone: 0.15,
  author: 0.25,
  novelty: 0.2,
  session: 0.1,
} as const;

const MIN_SAMPLE = {
  daily: 5,
  weekly: 12,
} as const;

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

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

  return shannonEntropy(distribution) / Math.log2(distribution.length);
}

function topShare(distribution: DistributionEntry[], limit = 1) {
  return takeTopEntries(distribution, limit).reduce((sum, item) => sum + item.share, 0);
}

function topicIndex(summary: WindowSummary) {
  const entropyNarrowness = 1 - normalizeEntropy(summary.topicDistribution);
  return clamp01(entropyNarrowness * 0.7 + topShare(summary.topicDistribution, 1) * 0.3);
}

function zoneIndex(summary: WindowSummary) {
  const entropyNarrowness = 1 - normalizeEntropy(summary.zoneDistribution);
  return clamp01(entropyNarrowness * 0.65 + topShare(summary.zoneDistribution, 1) * 0.35);
}

function authorIndex(summary: WindowSummary) {
  return clamp01(topShare(summary.authorDistribution, 3) * 0.75 + topShare(summary.authorDistribution, 1) * 0.25);
}

function noveltyIndex(summary: WindowSummary) {
  if (summary.noveltyRatio == null) {
    return null;
  }

  return clamp01(1 - summary.noveltyRatio);
}

function sessionIndex(summary: WindowSummary) {
  const longestHourShare = topShare(summary.activeHours, 1);
  const avgDuration = clamp01(summary.avgDurationMinutes / 20);
  const totalDuration = clamp01(summary.totalDurationMinutes / 180);
  return clamp01(longestHourShare * 0.45 + avgDuration * 0.35 + totalDuration * 0.2);
}

function amplifiedPositiveDelta(current: number | null, previous: number | null) {
  if (current == null || previous == null) {
    return 0;
  }

  return clamp01(Math.max(0, current - previous) * 2.5);
}

function dimensionDirection(delta: number | null): ComparisonDimension["direction"] {
  if (delta == null) {
    return "样本不足";
  }
  if (delta >= 0.05) {
    return "收窄";
  }
  if (delta <= -0.05) {
    return "扩散";
  }
  return "持平";
}

function makeDimension(input: {
  key: ComparisonDimension["key"];
  label: string;
  weight: number;
  current: number | null;
  previous: number | null;
  evidence: string;
}) {
  const delta =
    input.current == null || input.previous == null
      ? null
      : Number((input.current - input.previous).toFixed(4));
  const contribution = Number((amplifiedPositiveDelta(input.current, input.previous) * input.weight * 100).toFixed(1));
  const direction = dimensionDirection(delta);

  return {
    key: input.key,
    label: input.label,
    weight: input.weight,
    current: input.current == null ? null : Number(input.current.toFixed(4)),
    previous: input.previous == null ? null : Number(input.previous.toFixed(4)),
    delta,
    direction,
    scoreContribution: contribution,
    evidence: input.evidence,
    significant: contribution >= input.weight * 18,
  } satisfies ComparisonDimension;
}

function topLabel(distribution: DistributionEntry[]) {
  return takeTopEntries(distribution, 1)[0];
}

function buildEvidence(current: WindowSummary, previous: WindowSummary, dimensions: ComparisonDimension[]) {
  const currentTopTopic = topLabel(current.topicDistribution);
  const previousTopTopic = topLabel(previous.topicDistribution);
  const currentTopZone = topLabel(current.zoneDistribution);
  const previousTopZone = topLabel(previous.zoneDistribution);
  const currentTopAuthor = topLabel(current.authorDistribution);
  const previousTopAuthor = topLabel(previous.authorDistribution);

  return [
    `主题从 ${previousTopTopic?.label ?? "无明显主题"} ${previousTopTopic ? `(${percent(previousTopTopic.share)})` : ""} 变化到 ${currentTopTopic?.label ?? "无明显主题"} ${currentTopTopic ? `(${percent(currentTopTopic.share)})` : ""}。`,
    `分区从 ${previousTopZone?.label ?? "无明显分区"} ${previousTopZone ? `(${percent(previousTopZone.share)})` : ""} 变化到 ${currentTopZone?.label ?? "无明显分区"} ${currentTopZone ? `(${percent(currentTopZone.share)})` : ""}。`,
    `UP 主从 ${previousTopAuthor?.label ?? "无明显集中"} ${previousTopAuthor ? `(${percent(previousTopAuthor.share)})` : ""} 变化到 ${currentTopAuthor?.label ?? "无明显集中"} ${currentTopAuthor ? `(${percent(currentTopAuthor.share)})` : ""}。`,
    ...dimensions.map((dimension) => dimension.evidence),
  ];
}

export function computeCocononScore(input: ScoreInput): ComparisonBreakdown {
  const sampleSufficient =
    input.current.totalVideos >= MIN_SAMPLE[input.period] &&
    input.previous.totalVideos >= MIN_SAMPLE[input.period];

  const currentTopic = topicIndex(input.current);
  const previousTopic = topicIndex(input.previous);
  const currentZone = zoneIndex(input.current);
  const previousZone = zoneIndex(input.previous);
  const currentAuthor = authorIndex(input.current);
  const previousAuthor = authorIndex(input.previous);
  const currentNovelty = noveltyIndex(input.current);
  const previousNovelty = noveltyIndex(input.previous);
  const currentSession = sessionIndex(input.current);
  const previousSession = sessionIndex(input.previous);

  const dimensions = [
    makeDimension({
      key: "topic",
      label: "主题收窄变化",
      weight: SCORE_WEIGHTS.topic,
      current: sampleSufficient ? currentTopic : null,
      previous: sampleSufficient ? previousTopic : null,
      evidence: `主题集中指数从 ${percent(previousTopic)} 变为 ${percent(currentTopic)}，变化 ${signedPercent(currentTopic - previousTopic)}。`,
    }),
    makeDimension({
      key: "zone",
      label: "分区收窄变化",
      weight: SCORE_WEIGHTS.zone,
      current: sampleSufficient ? currentZone : null,
      previous: sampleSufficient ? previousZone : null,
      evidence: `分区集中指数从 ${percent(previousZone)} 变为 ${percent(currentZone)}，变化 ${signedPercent(currentZone - previousZone)}。`,
    }),
    makeDimension({
      key: "author",
      label: "UP 主收窄变化",
      weight: SCORE_WEIGHTS.author,
      current: sampleSufficient ? currentAuthor : null,
      previous: sampleSufficient ? previousAuthor : null,
      evidence: `UP 主集中指数从 ${percent(previousAuthor)} 变为 ${percent(currentAuthor)}，变化 ${signedPercent(currentAuthor - previousAuthor)}。`,
    }),
    makeDimension({
      key: "novelty",
      label: "新颖度下降变化",
      weight: SCORE_WEIGHTS.novelty,
      current: sampleSufficient ? currentNovelty : null,
      previous: sampleSufficient ? previousNovelty : null,
      evidence:
        input.current.noveltyRatio == null || input.previous.noveltyRatio == null
          ? "新颖度样本不足。"
          : `新主题/新 UP 主占比从 ${percent(input.previous.noveltyRatio)} 变为 ${percent(input.current.noveltyRatio)}。`,
    }),
    makeDimension({
      key: "session",
      label: "消费隧道化变化",
      weight: SCORE_WEIGHTS.session,
      current: sampleSufficient ? currentSession : null,
      previous: sampleSufficient ? previousSession : null,
      evidence: `观看时段/时长指数从 ${percent(previousSession)} 变为 ${percent(currentSession)}，变化 ${signedPercent(currentSession - previousSession)}。`,
    }),
  ];

  const narrowedDimensions = dimensions.filter((dimension) => dimension.direction === "收窄" && dimension.significant).length;
  const localNarrowingDimensions = dimensions.filter((dimension) => dimension.direction === "收窄").length;
  const widenedDimensions = dimensions.filter((dimension) => dimension.direction === "扩散").length;
  const rawScore = Math.round(dimensions.reduce((sum, dimension) => sum + dimension.scoreContribution, 0));
  const score =
    sampleSufficient
      ? narrowedDimensions >= 3
        ? rawScore
        : Math.round(rawScore * 0.75)
      : null;

  let comparisonLabel = "基本持平";
  if (!sampleSufficient) {
    comparisonLabel = "样本不足";
  } else if (narrowedDimensions >= 3 && (score ?? 0) >= 45) {
    comparisonLabel = "更进入信息茧房";
  } else if (widenedDimensions >= 3 && rawScore < 20) {
    comparisonLabel = "有所扩散";
  } else if (localNarrowingDimensions >= 1) {
    comparisonLabel = "局部收窄";
  }

  const level: "低" | "中" | "高" | null =
    score == null ? null : score >= 68 ? "高" : score >= 35 ? "中" : "低";

  return {
    period: input.period,
    sampleSufficient,
    sampleMessage: sampleSufficient
      ? null
      : `${input.period === "daily" ? "日" : "周"}样本不足，暂不输出 coconon score。`,
    score,
    level,
    comparisonLabel,
    evidence: buildEvidence(input.current, input.previous, dimensions),
    dimensions,
    narrowedDimensions,
    widenedDimensions,
    current: input.current,
    previous: input.previous,
  };
}
