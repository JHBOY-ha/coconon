export const CredentialStatus = {
  UNVERIFIED: "UNVERIFIED",
  ACTIVE: "ACTIVE",
  EXPIRED: "EXPIRED",
  INVALID: "INVALID",
} as const;

export type CredentialStatus = (typeof CredentialStatus)[keyof typeof CredentialStatus];

export const TagSource = {
  RULE: "RULE",
  LLM: "LLM",
  FALLBACK: "FALLBACK",
} as const;

export type TagSource = (typeof TagSource)[keyof typeof TagSource];

export const TagStatus = {
  PENDING: "PENDING",
  RULE_ONLY: "RULE_ONLY",
  ENRICHED: "ENRICHED",
  FAILED: "FAILED",
} as const;

export type TagStatus = (typeof TagStatus)[keyof typeof TagStatus];

export const JobType = {
  SYNC: "SYNC",
  TAG: "TAG",
  REPORT: "REPORT",
  FULL: "FULL",
} as const;

export type JobType = (typeof JobType)[keyof typeof JobType];

export const JobStatus = {
  RUNNING: "RUNNING",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  PARTIAL: "PARTIAL",
} as const;

export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];
