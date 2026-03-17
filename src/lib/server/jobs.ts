import { JobStatus, JobType } from "@/lib/db-types";
import { prisma } from "@/lib/prisma";
import type { DailyReportRecord, JobRunRecord, WeeklyReportRecord } from "@/lib/store-types";
import type { TagJobProgress, TagQueueSummary } from "@/lib/types";
import { formatDay, formatWeekKey } from "@/lib/utils";
import { markCredentialError, syncWatchHistory } from "@/lib/server/bilibili";
import { finishJob, startJob, updateJobDetails } from "@/lib/server/job-run";
import { generateReports, getTagQueueSummary, tagPendingItems } from "@/lib/server/reporting";

function parseTagJobDetails(details: string | null): TagJobProgress | null {
  if (!details) {
    return null;
  }

  try {
    return JSON.parse(details) as TagJobProgress;
  } catch {
    return null;
  }
}

export async function getRunningTagJob() {
  const jobs = (await prisma.jobRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 20,
  })) as JobRunRecord[];

  const job = jobs.find((item) => item.jobType === JobType.TAG && item.status === JobStatus.RUNNING) ?? null;

  if (!job) {
    return null;
  }

  return {
    ...job,
    progress: parseTagJobDetails(job.details),
  };
}

export async function getTagQueueOverview(maxItems?: number) {
  const [queue, activeJob] = await Promise.all([
    getTagQueueSummary({ maxItems }),
    getRunningTagJob(),
  ]);

  return {
    queue,
    activeJob,
  };
}

export async function runSyncJob(trigger: string, full = false) {
  const job = await startJob(JobType.SYNC, trigger, { full });
  const startedAt = new Date();

  try {
    const result = await syncWatchHistory({ trigger, full });
    await finishJob(job.id, JobStatus.SUCCESS, startedAt, { details: result });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "同步失败";
    await markCredentialError(message);
    await finishJob(job.id, JobStatus.FAILED, startedAt, { errorMessage: message });
    throw error;
  }
}

async function executeTagJob(
  job: JobRunRecord,
  options?: { batchSize?: number; maxItems?: number; summary?: TagQueueSummary },
) {
  const startedAt = job.startedAt;
  const summary =
    options?.summary ??
    (await getTagQueueSummary({
      maxItems: options?.maxItems,
    }));

  try {
    const result = await tagPendingItems({
      ...options,
      summary,
      onProgress: async (progress) => {
        await updateJobDetails(job.id, progress);
      },
    });
    await finishJob(job.id, JobStatus.SUCCESS, startedAt, { details: result });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "标签生成失败";
    await finishJob(job.id, JobStatus.FAILED, startedAt, { errorMessage: message });
    throw error;
  }
}

export async function runTagJob(trigger: string, options?: { batchSize?: number; maxItems?: number }) {
  const summary = await getTagQueueSummary({ maxItems: options?.maxItems });
  const job = await startJob(JobType.TAG, trigger, {
    ...summary,
    processed: 0,
    remaining: summary.totalPending,
    percent: summary.totalPending === 0 ? 100 : 0,
    estimatedRemainingSeconds: summary.estimatedSeconds,
  });

  return executeTagJob(job as JobRunRecord, {
    ...options,
    summary,
  });
}

export async function startTagJob(trigger: string, options?: { batchSize?: number; maxItems?: number }) {
  const runningJob = await getRunningTagJob();
  if (runningJob) {
    return {
      started: false,
      job: runningJob,
      queue: await getTagQueueSummary({ maxItems: options?.maxItems }),
    };
  }

  const queue = await getTagQueueSummary({ maxItems: options?.maxItems });
  if (queue.totalPending === 0) {
    return {
      started: false,
      job: null,
      queue,
    };
  }

  const job = (await startJob(JobType.TAG, trigger, {
    ...queue,
    processed: 0,
    remaining: queue.totalPending,
    percent: queue.totalPending === 0 ? 100 : 0,
    estimatedRemainingSeconds: queue.estimatedSeconds,
  })) as JobRunRecord;

  void executeTagJob(job, {
    ...options,
    summary: queue,
  });

  return {
    started: true,
    job: {
      ...job,
      progress: {
        ...queue,
        processed: 0,
        remaining: queue.totalPending,
        percent: queue.totalPending === 0 ? 100 : 0,
        estimatedRemainingSeconds: queue.estimatedSeconds,
      },
    },
    queue,
  };
}

export async function runReportJob(
  trigger: string,
  options: { period?: "daily" | "weekly" | "both"; dayKey?: string; weekKey?: string } = {},
) {
  const period = options.period ?? "daily";
  const dayKey = options.dayKey ?? formatDay(new Date());
  const weekKey = options.weekKey ?? formatWeekKey(new Date());
  const job = await startJob(JobType.REPORT, trigger, { period, dayKey, weekKey });
  const startedAt = new Date();

  try {
    const report = await generateReports({
      period,
      dayKey,
      weekKey,
    });
    await finishJob(job.id, JobStatus.SUCCESS, startedAt, {
      details: {
        period,
        daily:
          report.daily == null
            ? null
            : {
                date: (report.daily as DailyReportRecord).date,
                cocononScore: (report.daily as DailyReportRecord).cocononScore,
              },
        weekly:
          report.weekly == null
            ? null
            : {
                weekKey: (report.weekly as WeeklyReportRecord).weekKey,
                cocononScore: (report.weekly as WeeklyReportRecord).cocononScore,
              },
      },
    });
    return report;
  } catch (error) {
    const message = error instanceof Error ? error.message : "日报生成失败";
    await finishJob(job.id, JobStatus.FAILED, startedAt, { errorMessage: message });
    throw error;
  }
}

export async function runFullPipeline(trigger: string, options: { full?: boolean; dayKey?: string } = {}) {
  const job = await startJob(JobType.FULL, trigger, options);
  const startedAt = new Date();

  try {
    const sync = await runSyncJob(`${trigger}:sync`, options.full);
    const tags = await runTagJob(`${trigger}:tag`);
    const report = await runReportJob(`${trigger}:report`, {
      period: "both",
      dayKey: options.dayKey,
      weekKey: formatWeekKey(new Date()),
    });

    const result = {
      sync,
      tags,
      report,
    };

    await finishJob(job.id, JobStatus.SUCCESS, startedAt, { details: result });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "全量任务失败";
    await finishJob(job.id, JobStatus.FAILED, startedAt, { errorMessage: message });
    throw error;
  }
}
