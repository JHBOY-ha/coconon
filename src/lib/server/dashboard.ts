import { prisma } from "@/lib/prisma";
import { ensureAppConfig, ensureBiliCredential } from "@/lib/server/config";
import type {
  AppConfigRecord,
  BiliCredentialRecord,
  DailyReportRecord,
  JobRunRecord,
  WeeklyReportRecord,
} from "@/lib/store-types";
import { formatDay, formatWeekKey } from "@/lib/utils";

export async function getDashboardSummary(): Promise<{
  appConfig: AppConfigRecord;
  credential: BiliCredentialRecord;
  latestDailyReport: DailyReportRecord | null;
  latestWeeklyReport: WeeklyReportRecord | null;
  dailyReports: Array<DailyReportRecord & { dayKey: string }>;
  weeklyReports: Array<WeeklyReportRecord & { hrefKey: string }>;
  recentJobs: JobRunRecord[];
}> {
  const [appConfig, credential, latestDailyReport, latestWeeklyReport, dailyReports, weeklyReports, recentJobs] =
    await Promise.all([
      ensureAppConfig(),
      ensureBiliCredential(),
      prisma.dailyReport.findFirst({
        orderBy: { date: "desc" },
      }),
      prisma.weeklyReport.findFirst({
        orderBy: { windowStart: "desc" },
      }),
      prisma.dailyReport.findMany({
        orderBy: { date: "desc" },
        take: 7,
      }),
      prisma.weeklyReport.findMany({
        orderBy: { windowStart: "desc" },
        take: 4,
      }),
      prisma.jobRun.findMany({
        orderBy: { startedAt: "desc" },
        take: 8,
      }),
    ]);

  return {
    appConfig: appConfig as AppConfigRecord,
    credential: credential as BiliCredentialRecord,
    latestDailyReport: latestDailyReport as DailyReportRecord | null,
    latestWeeklyReport: latestWeeklyReport as WeeklyReportRecord | null,
    dailyReports: (dailyReports as DailyReportRecord[]).map((report) => ({
      ...report,
      dayKey: formatDay(report.date),
    })),
    weeklyReports: (weeklyReports as WeeklyReportRecord[]).map((report) => ({
      ...report,
      hrefKey: formatWeekKey(report.windowStart),
    })),
    recentJobs: recentJobs as JobRunRecord[],
  };
}
