import Link from "next/link";
import { AlertTriangle, ArrowRight, BrainCircuit, Clock3, Sparkles } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { ManualActions } from "@/components/manual-actions";
import { Panel } from "@/components/panel";
import { getDashboardSummary } from "@/lib/server/dashboard";
import type { DailyReportRecord, JobRunRecord } from "@/lib/store-types";
import { formatDay, percent } from "@/lib/utils";

function ScoreBadge({ score, level }: { score: number; level: string }) {
  const palette =
    level === "高"
      ? "bg-red-100 text-red-800"
      : level === "中"
        ? "bg-amber-100 text-amber-800"
        : "bg-emerald-100 text-emerald-800";

  return (
    <span className={`rounded-full px-3 py-1 text-sm ${palette}`}>
      {level}风险 · {score} 分
    </span>
  );
}

export default async function HomePage() {
  const summary = await getDashboardSummary();
  const latestReport = summary.latestReport;
  const latestMetrics = latestReport?.metrics as
    | string
    | undefined;
  const parsedMetrics = latestMetrics
    ? (JSON.parse(latestMetrics) as {
        totalVideos?: number;
        totalDuration?: string;
        noveltyRatio?: number | null;
      })
    : undefined;

  return (
    <AppShell currentPath="/">
      <div className="space-y-6">
        <Panel className="overflow-hidden">
          <div className="grid gap-8 lg:grid-cols-[1.4fr_0.9fr]">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.35em] text-stone-500">Dashboard</p>
              <h2 className="mt-4 max-w-3xl font-serif text-5xl leading-tight text-stone-950">
                把每天刷过的视频，变成一份关于注意力结构的日报。
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-8 text-stone-600">
                cocoon 会自动同步 Bilibili 观看历史，识别主题、追踪变化，并给出“今天是否更容易陷进信息茧房”的判断。
              </p>
            </div>

            <div className="rounded-[2rem] bg-stone-900 p-6 text-stone-50">
              <div className="flex items-center justify-between text-sm text-stone-300">
                <span>最新日报</span>
                {latestReport ? <span>{formatDay(latestReport.date)}</span> : null}
              </div>
              {latestReport ? (
                <>
                  <div className="mt-4">
                    <ScoreBadge score={latestReport.cocoonScore} level={latestReport.cocoonLevel} />
                  </div>
                  <p className="mt-4 text-2xl leading-9">{latestReport.summary}</p>
                  <div className="mt-6 grid grid-cols-2 gap-3 text-sm text-stone-200">
                    <div className="rounded-2xl bg-white/10 p-4">
                      <p>观看条数</p>
                      <p className="mt-2 text-xl text-stone-50">{parsedMetrics?.totalVideos ?? 0}</p>
                    </div>
                    <div className="rounded-2xl bg-white/10 p-4">
                      <p>累计时长</p>
                      <p className="mt-2 text-xl text-stone-50">{parsedMetrics?.totalDuration ?? "0 分钟"}</p>
                    </div>
                  </div>
                  <Link
                    href={`/reports/${formatDay(latestReport.date)}`}
                    className="mt-6 inline-flex items-center gap-2 text-sm text-stone-50 underline underline-offset-4"
                  >
                    打开日报 <ArrowRight className="h-4 w-4" />
                  </Link>
                </>
              ) : (
                <div className="mt-6 space-y-4">
                  <p className="text-lg text-stone-200">还没有日报。先在设置页绑定 Cookie，然后执行一次全量同步。</p>
                  <Link href="/settings" className="inline-flex items-center gap-2 text-sm underline underline-offset-4">
                    去设置页 <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </Panel>

        <Panel>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-stone-500">Runbooks</p>
              <h3 className="mt-2 font-serif text-3xl text-stone-950">手动运行入口</h3>
            </div>
            <p className="max-w-md text-right text-sm leading-6 text-stone-600">
              定时任务会按设置页时间自动触发；这里保留手动重跑能力，便于首次导入和调试。
            </p>
          </div>

          <div className="mt-6">
            <ManualActions />
          </div>
        </Panel>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Panel>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-stone-500">Recent reports</p>
                <h3 className="mt-2 font-serif text-3xl">最近 7 天</h3>
              </div>
              <div className="rounded-full bg-stone-100 px-4 py-2 text-sm text-stone-600">
                {summary.reports.length} 份日报
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {summary.reports.length > 0 ? (
                summary.reports.map((report: DailyReportRecord & { dayKey: string }) => (
                  <Link
                    key={report.id}
                    href={`/reports/${report.dayKey}`}
                    className="flex items-center justify-between rounded-[1.5rem] border border-stone-200 bg-stone-50/80 p-4 hover:border-stone-900/20"
                  >
                    <div>
                      <p className="text-sm uppercase tracking-[0.2em] text-stone-500">{report.dayKey}</p>
                      <p className="mt-2 text-base text-stone-900">{report.summary}</p>
                    </div>
                    <div className="text-right">
                      <ScoreBadge score={report.cocoonScore} level={report.cocoonLevel} />
                      <p className="mt-2 text-sm text-stone-500">{report.comparisonLabel}</p>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-stone-300 p-6 text-sm leading-7 text-stone-600">
                  目前没有可回看的日报。配置 Cookie 后执行同步和日报生成，这里会自动出现历史记录。
                </div>
              )}
            </div>
          </Panel>

          <div className="space-y-6">
            <Panel>
              <div className="flex items-center gap-3">
                <BrainCircuit className="h-5 w-5 text-stone-700" />
                <h3 className="font-serif text-2xl text-stone-950">系统状态</h3>
              </div>

              <div className="mt-5 grid gap-4">
                <div className="rounded-3xl bg-stone-100/70 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-stone-600">Cookie 状态</span>
                    <span className="text-sm font-medium text-stone-900">{summary.credential.status}</span>
                  </div>
                  <p className="mt-2 text-sm text-stone-500">{summary.credential.failureReason ?? "可用于下一次同步。"}</p>
                </div>
                <div className="rounded-3xl bg-stone-100/70 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-stone-600">定时同步</span>
                    <span className="text-sm font-medium text-stone-900">
                      每天 {String(summary.appConfig.syncHour).padStart(2, "0")}:
                      {String(summary.appConfig.syncMinute).padStart(2, "0")}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-stone-500">时区 {summary.appConfig.timezone}</p>
                </div>
              </div>
            </Panel>

            <Panel>
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-stone-700" />
                <h3 className="font-serif text-2xl text-stone-950">最近一次判断</h3>
              </div>
              {latestReport ? (
                <div className="mt-5 space-y-4">
                  <div className="rounded-3xl bg-stone-100/70 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-stone-600">结论</span>
                      <span className="text-sm font-medium text-stone-900">{latestReport.comparisonLabel}</span>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-stone-700">{latestReport.summary}</p>
                  </div>
                  <div className="rounded-3xl bg-stone-100/70 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-stone-600">新颖度</span>
                        <span className="text-sm font-medium text-stone-900">
                        {parsedMetrics?.noveltyRatio != null ? percent(parsedMetrics.noveltyRatio) : "样本不足"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-stone-500">
                      新颖度越低，说明今天内容更容易落在你已经熟悉的主题和 UP 主范围内。
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-5 flex items-center gap-3 rounded-3xl bg-stone-100/70 p-4 text-sm leading-7 text-stone-600">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-stone-500" />
                  尚无判断结果。
                </div>
              )}
            </Panel>

            <Panel>
              <div className="flex items-center gap-3">
                <Clock3 className="h-5 w-5 text-stone-700" />
                <h3 className="font-serif text-2xl text-stone-950">最近任务</h3>
              </div>
              <div className="mt-4 space-y-3">
                {summary.recentJobs.map((job: JobRunRecord) => (
                  <div key={job.id} className="rounded-3xl bg-stone-100/70 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm font-medium text-stone-900">{job.jobType}</span>
                      <span className="text-sm text-stone-600">{job.status}</span>
                    </div>
                    <p className="mt-1 text-sm text-stone-500">
                      {formatDay(job.startedAt)} · {job.trigger}
                    </p>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
