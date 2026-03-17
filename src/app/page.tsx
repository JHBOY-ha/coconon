import Link from "next/link";
import { AlertTriangle, ArrowRight, BrainCircuit, Clock3, Sparkles } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { ManualActions } from "@/components/manual-actions";
import { Panel } from "@/components/panel";
import { getDashboardSummary } from "@/lib/server/dashboard";
import type { DailyReportRecord, JobRunRecord, WeeklyReportRecord } from "@/lib/store-types";
import { formatDateTime, formatDay } from "@/lib/utils";

function ScoreBadge({ score, level }: { score: number | null; level: string | null }) {
  if (score == null || !level) {
    return <span className="rounded-full bg-stone-200 px-3 py-1 text-sm text-stone-600">样本不足</span>;
  }

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

function ReportHeroCard({
  label,
  summary,
  href,
  score,
  level,
  title,
}: {
  label: string;
  title: string;
  summary: string | null;
  href: string | null;
  score: number | null;
  level: string | null;
}) {
  return (
    <div className="rounded-[2rem] bg-stone-900 p-6 text-stone-50">
      <div className="flex items-center justify-between text-sm text-stone-300">
        <span>{label}</span>
        <ScoreBadge score={score} level={level} />
      </div>
      <p className="mt-4 text-lg text-stone-300">{title}</p>
      <p className="mt-3 text-2xl leading-9">{summary ?? "还没有生成这类报告。"}</p>
      {href ? (
        <Link href={href} className="mt-6 inline-flex items-center gap-2 text-sm text-stone-50 underline underline-offset-4">
          打开详情 <ArrowRight className="h-4 w-4" />
        </Link>
      ) : null}
    </div>
  );
}

export default async function HomePage() {
  const summary = await getDashboardSummary();
  const latestDaily = summary.latestDailyReport;
  const latestWeekly = summary.latestWeeklyReport;

  return (
    <AppShell currentPath="/">
      <div className="space-y-6">
        <Panel className="overflow-hidden">
          <div className="space-y-8">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.35em] text-stone-500">Dashboard</p>
              <h2 className="mt-4 max-w-4xl font-serif text-5xl leading-tight text-stone-950">
                把每天刷过的视频，变成一份关于注意力结构变化的报告。
              </h2>
              <p className="mt-4 max-w-3xl text-base leading-8 text-stone-600">
                coconon 不再只看“今天内部是否集中”，而是比较今日与昨日、本周与上周，判断你是否正在更深地进入信息茧房。
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ReportHeroCard
                label="今日日分"
                title={latestDaily?.comparisonLabel ?? "尚无日报"}
                summary={latestDaily?.summary ?? null}
                href={latestDaily ? `/reports/${formatDay(latestDaily.date)}` : null}
                score={latestDaily?.cocononScore ?? null}
                level={latestDaily?.cocononLevel ?? null}
              />
              <ReportHeroCard
                label="本周周分"
                title={latestWeekly?.comparisonLabel ?? "尚无周报"}
                summary={latestWeekly?.summary ?? null}
                href={latestWeekly ? `/reports/weekly/${latestWeekly.weekKey}` : null}
                score={latestWeekly?.cocononScore ?? null}
                level={latestWeekly?.cocononLevel ?? null}
              />
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
                <p className="text-sm uppercase tracking-[0.25em] text-stone-500">Recent daily reports</p>
                <h3 className="mt-2 font-serif text-3xl">最近日报</h3>
              </div>
              <div className="rounded-full bg-stone-100 px-4 py-2 text-sm text-stone-600">
                {summary.dailyReports.length} 份日报
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {summary.dailyReports.length > 0 ? (
                summary.dailyReports.map((report: DailyReportRecord & { dayKey: string }) => (
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
                      <ScoreBadge score={report.cocononScore} level={report.cocononLevel} />
                      <p className="mt-2 text-sm text-stone-500">{report.comparisonLabel}</p>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-stone-300 p-6 text-sm leading-7 text-stone-600">
                  目前没有可回看的日报。完成同步、补标签后生成今日日报即可。
                </div>
              )}
            </div>
          </Panel>

          <div className="space-y-6">
            <Panel>
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-stone-700" />
                <h3 className="font-serif text-2xl text-stone-950">最近周报</h3>
              </div>
              <div className="mt-5 space-y-4">
                {summary.weeklyReports.length > 0 ? (
                  summary.weeklyReports.map((report: WeeklyReportRecord & { hrefKey: string }) => (
                    <Link
                      key={report.id}
                      href={`/reports/weekly/${report.hrefKey}`}
                      className="block rounded-[1.5rem] border border-stone-200 bg-stone-50/80 p-4 hover:border-stone-900/20"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-sm uppercase tracking-[0.2em] text-stone-500">{report.hrefKey}</p>
                        <ScoreBadge score={report.cocononScore} level={report.cocononLevel} />
                      </div>
                      <p className="mt-2 text-base text-stone-900">{report.summary}</p>
                      <p className="mt-2 text-sm text-stone-500">{report.comparisonLabel}</p>
                    </Link>
                  ))
                ) : (
                  <div className="rounded-[1.5rem] border border-dashed border-stone-300 p-6 text-sm leading-7 text-stone-600">
                    目前没有可回看的周报。生成本周周报后，这里会出现周趋势结果。
                  </div>
                )}
              </div>
            </Panel>

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
                <BrainCircuit className="h-5 w-5 text-stone-700" />
                <h3 className="font-serif text-2xl text-stone-950">评分怎么来的</h3>
              </div>
              <div className="mt-4 space-y-3 text-sm leading-7 text-stone-600">
                <p>当前的 coconon score 是比较分，不是静态兴趣分。</p>
                <p>日分比较“今日 vs 昨日”，周分比较“本周 vs 上周”。系统会对主题、分区、UP 主、新颖度、观看时长与时段这 5 个维度逐项比较。</p>
                <p>只有多个维度一起朝更窄方向变化时，才会判定为更进入信息茧房；样本不足时不输出总分。</p>
              </div>
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
                      {formatDateTime(job.startedAt)} · {job.trigger}
                    </p>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>

        {!latestDaily && !latestWeekly ? (
          <Panel>
            <div className="flex items-center gap-3 rounded-3xl bg-stone-100/70 p-4 text-sm leading-7 text-stone-600">
              <AlertTriangle className="h-5 w-5 shrink-0 text-stone-500" />
              尚无比较报告。先同步历史并补全标签，再生成日报或周报。
            </div>
          </Panel>
        ) : null}
      </div>
    </AppShell>
  );
}
