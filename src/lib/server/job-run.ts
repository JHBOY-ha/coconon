import { JobStatus, JobType } from "@/lib/db-types";
import { prisma } from "@/lib/prisma";
import type { JobRunRecord } from "@/lib/store-types";

export async function startJob(
  jobType: JobType,
  trigger: string,
  details?: unknown,
): Promise<JobRunRecord> {
  return (await prisma.jobRun.create({
    data: {
      jobType,
      trigger,
      status: JobStatus.RUNNING,
      details: details ? JSON.stringify(details) : undefined,
    },
  })) as JobRunRecord;
}

export async function finishJob(
  jobId: string,
  status: JobStatus,
  startedAt: Date,
  payload: {
    details?: unknown;
    errorMessage?: string;
  } = {},
): Promise<JobRunRecord> {
  return (await prisma.jobRun.update({
    where: { id: jobId },
    data: {
      status,
      details: payload.details ? JSON.stringify(payload.details) : undefined,
      errorMessage: payload.errorMessage,
      finishedAt: new Date(),
      durationMs: Date.now() - startedAt.getTime(),
    },
  })) as JobRunRecord;
}

export async function updateJobDetails(jobId: string, details: unknown): Promise<JobRunRecord> {
  return (await prisma.jobRun.update({
    where: { id: jobId },
    data: {
      details: JSON.stringify(details),
    },
  })) as JobRunRecord;
}
