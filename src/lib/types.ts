export type DistributionEntry = {
  label: string;
  count: number;
  share: number;
};

export type DailyBreakdown = {
  sampleSize: number;
  topicEntropy: number;
  topicNarrowness: number;
  categoryConcentration: number;
  authorRepetition: number;
  noveltyDrop: number;
  sessionTunnel: number;
  score: number;
  level: "低" | "中" | "高";
  comparisonLabel: string;
  evidence: string[];
  insufficientSample: boolean;
};

export type LlmTagResult = {
  tags: string[];
  summary: string;
};

export type ReportPromptPayload = {
  dayKey: string;
  previousDayKey?: string;
  totalVideos: number;
  totalDurationMinutes: number;
  topTopics: DistributionEntry[];
  topAuthors: DistributionEntry[];
  topZones: DistributionEntry[];
  noveltyRatio: number | null;
  cocoonScore: number;
  cocoonLevel: "低" | "中" | "高";
  comparisonLabel: string;
  evidence: string[];
};
