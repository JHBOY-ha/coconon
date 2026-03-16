import { prisma } from "@/lib/prisma";
import { ensureAppConfig, ensureBiliCredential } from "@/lib/server/config";
import type {
  AppConfigRecord,
  BiliCredentialRecord,
  DailyReportRecord,
  JobRunRecord,
} from "@/lib/store-types";
import { formatDay } from "@/lib/utils";

export async function getDashboardSummary(): Promise<{
  appConfig: AppConfigRecord;
  credential: BiliCredentialRecord;
  latestReport: DailyReportRecord | null;
  reports: Array<DailyReportRecord & { dayKey: string }>;
  recentJobs: JobRunRecord[];
}> {
  const [appConfig, credential, latestReport, reports, recentJobs] = await Promise.all([
    ensureAppConfig(),
    ensureBiliCredential(),
    prisma.dailyReport.findFirst({
      orderBy: { date: "desc" },
    }),
    prisma.dailyReport.findMany({
      orderBy: { date: "desc" },
      take: 7,
    }),
    prisma.jobRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 8,
    }),
  ]);

  return {
    appConfig: appConfig as AppConfigRecord,
    credential: credential as BiliCredentialRecord,
    latestReport: latestReport as DailyReportRecord | null,
    reports: (reports as DailyReportRecord[]).map((report: DailyReportRecord) => ({
      ...report,
      dayKey: formatDay(report.date),
    })),
    recentJobs: recentJobs as JobRunRecord[],
  };
}
