import { JobStatus, JobType } from "@/lib/db-types";
import { formatDay } from "@/lib/utils";
import { markCredentialError, syncWatchHistory } from "@/lib/server/bilibili";
import { finishJob, startJob } from "@/lib/server/job-run";
import { generateDailyReport, tagPendingItems } from "@/lib/server/reporting";

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

export async function runTagJob(trigger: string) {
  const job = await startJob(JobType.TAG, trigger);
  const startedAt = new Date();

  try {
    const result = await tagPendingItems();
    await finishJob(job.id, JobStatus.SUCCESS, startedAt, { details: result });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "标签生成失败";
    await finishJob(job.id, JobStatus.FAILED, startedAt, { errorMessage: message });
    throw error;
  }
}

export async function runReportJob(trigger: string, dayKey = formatDay(new Date())) {
  const job = await startJob(JobType.REPORT, trigger, { dayKey });
  const startedAt = new Date();

  try {
    const report = await generateDailyReport(dayKey);
    await finishJob(job.id, JobStatus.SUCCESS, startedAt, {
      details: { date: dayKey, cocoonScore: report.cocoonScore },
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
    const report = await runReportJob(`${trigger}:report`, options.dayKey);

    const result = {
      sync,
      tags,
      report: {
        date: report.date,
        cocoonScore: report.cocoonScore,
      },
    };

    await finishJob(job.id, JobStatus.SUCCESS, startedAt, { details: result });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "全量任务失败";
    await finishJob(job.id, JobStatus.FAILED, startedAt, { errorMessage: message });
    throw error;
  }
}
