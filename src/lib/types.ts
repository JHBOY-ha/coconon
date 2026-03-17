export type DistributionEntry = {
  label: string;
  count: number;
  share: number;
};

export type ComparisonPeriod = "daily" | "weekly";

export type ComparisonDirection = "收窄" | "扩散" | "持平" | "样本不足";

export type ComparisonDimension = {
  key: "topic" | "zone" | "author" | "novelty" | "session";
  label: string;
  weight: number;
  current: number | null;
  previous: number | null;
  delta: number | null;
  direction: ComparisonDirection;
  scoreContribution: number;
  evidence: string;
  significant: boolean;
};

export type WindowSummary = {
  label: string;
  totalVideos: number;
  totalDurationMinutes: number;
  avgDurationMinutes: number;
  noveltyRatio: number | null;
  topicDistribution: DistributionEntry[];
  zoneDistribution: DistributionEntry[];
  authorDistribution: DistributionEntry[];
  activeHours: DistributionEntry[];
};

export type WindowSnapshot = WindowSummary & {
  key: string;
  start: string;
  end: string;
  uniqueAuthors: number;
  uniqueTopics: number;
};

export type ComparisonBreakdown = {
  period: ComparisonPeriod;
  sampleSufficient: boolean;
  sampleMessage: string | null;
  score: number | null;
  level: "低" | "中" | "高" | null;
  comparisonLabel: string;
  evidence: string[];
  dimensions: ComparisonDimension[];
  narrowedDimensions: number;
  widenedDimensions: number;
  current: WindowSummary;
  previous: WindowSummary;
};

export type LlmTagResult = {
  tags: string[];
  summary: string;
};

export type ReportPromptPayload = {
  period: ComparisonPeriod;
  windowLabel: string;
  previousWindowLabel: string;
  score: number | null;
  level: "低" | "中" | "高" | null;
  comparisonLabel: string;
  sampleSufficient: boolean;
  current: WindowSummary;
  previous: WindowSummary;
  dimensions: ComparisonDimension[];
  evidence: string[];
};

export type TagQueueSummary = {
  totalPending: number;
  llmCandidates: number;
  ruleCandidates: number;
  estimatedSeconds: number;
};

export type TagJobProgress = TagQueueSummary & {
  processed: number;
  remaining: number;
  percent: number;
  estimatedRemainingSeconds: number;
};
