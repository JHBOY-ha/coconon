import type { CredentialStatus, JobStatus, JobType, TagSource, TagStatus } from "@/lib/db-types";

export type AppConfigRecord = {
  singleton: string;
  adminPasswordHash: string | null;
  llmBaseUrl: string | null;
  llmApiKeyEncrypted: string | null;
  llmModel: string | null;
  llmEnabled: number;
  syncHour: number;
  syncMinute: number;
  timezone: string;
  encryptionVersion: number;
  createdAt: Date;
  updatedAt: Date;
};

export type BiliCredentialRecord = {
  singleton: string;
  cookieEncrypted: string | null;
  cookiePreview: string | null;
  status: CredentialStatus;
  lastValidatedAt: Date | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ContentTagRecord = {
  id: string;
  watchHistoryItemId: string;
  label: string;
  source: TagSource;
  confidence: number | null;
  summary: string | null;
  createdAt: Date;
};

export type WatchHistoryItemRecord = {
  id: string;
  historyKey: string;
  bvid: string | null;
  aid: string | null;
  oid: string | null;
  business: string | null;
  title: string;
  authorName: string | null;
  authorMid: string | null;
  tagName: string | null;
  subTagName: string | null;
  watchedAt: Date;
  duration: number;
  progress: number | null;
  viewingAt: string | null;
  covers: string | null;
  rawPayload: string;
  summary: string | null;
  tagStatus: TagStatus;
  createdAt: Date;
  updatedAt: Date;
  contentTags?: ContentTagRecord[];
  __created?: boolean;
};

export type DailySnapshotRecord = {
  id: string;
  date: Date;
  totalVideos: number;
  totalDuration: number;
  uniqueAuthors: number;
  uniqueTopics: number;
  activeHours: string;
  topicDistribution: string;
  zoneDistribution: string;
  authorDistribution: string;
  noveltyRatio: number | null;
  scoreBreakdown: string;
  createdAt: Date;
  updatedAt: Date;
};

export type DailyReportRecord = {
  id: string;
  date: Date;
  summary: string;
  body: string;
  cocoonScore: number;
  cocoonLevel: string;
  comparisonLabel: string;
  evidence: string;
  metrics: string;
  createdAt: Date;
  updatedAt: Date;
};

export type JobRunRecord = {
  id: string;
  jobType: JobType;
  status: JobStatus;
  trigger: string;
  durationMs: number | null;
  startedAt: Date;
  finishedAt: Date | null;
  errorMessage: string | null;
  details: string | null;
};
