import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { Panel } from "@/components/panel";
import { prisma } from "@/lib/prisma";
import type { DailyReportRecord } from "@/lib/store-types";
import { parseDayKey, percent } from "@/lib/utils";

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  const report = (await prisma.dailyReport.findUnique({
    where: { date: parseDayKey(date) },
  })) as DailyReportRecord | null;

  if (!report) {
    notFound();
  }

  const evidence = JSON.parse(report.evidence) as string[];
  const metrics = (JSON.parse(report.metrics) as {
    totalVideos?: number;
    totalDuration?: string;
    noveltyRatio?: number | null;
    scoreBreakdown?: {
      topicNarrowness?: number;
      authorRepetition?: number;
      categoryConcentration?: number;
    };
  }) ?? { scoreBreakdown: {} };

  return (
    <AppShell currentPath="/">
      <div className="space-y-6">
        <Panel>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-stone-500">Daily report</p>
              <h2 className="mt-3 font-serif text-4xl text-stone-950">{date}</h2>
              <p className="mt-4 max-w-3xl text-base leading-8 text-stone-600">{report.summary}</p>
            </div>
            <div className="rounded-[1.75rem] bg-stone-900 px-5 py-4 text-stone-50">
              <p className="text-sm uppercase tracking-[0.2em] text-stone-400">Cocoon score</p>
              <p className="mt-2 text-3xl">{report.cocoonScore}</p>
              <p className="mt-1 text-sm text-stone-300">{report.cocoonLevel}风险 · {report.comparisonLabel}</p>
            </div>
          </div>
        </Panel>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Panel>
            <div className="report-body whitespace-pre-line text-base leading-8 text-stone-700">
              {report.body
                .split("\n\n")
                .filter(Boolean)
                .map((paragraph: string) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
            </div>

            <div className="mt-8 border-t border-stone-200 pt-6">
              <h3 className="font-serif text-2xl text-stone-950">关键证据</h3>
              <div className="mt-4 space-y-3">
                {evidence.map((entry: string) => (
                  <div key={entry} className="rounded-3xl bg-stone-100/80 p-4 text-sm leading-7 text-stone-700">
                    {entry}
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <div className="space-y-6">
            <Panel>
              <h3 className="font-serif text-2xl text-stone-950">指标卡</h3>
              <div className="mt-4 grid gap-3">
                <div className="rounded-3xl bg-stone-100/80 p-4">
                  <p className="text-sm text-stone-500">观看条数</p>
                  <p className="mt-2 text-2xl text-stone-950">{metrics.totalVideos ?? 0}</p>
                </div>
                <div className="rounded-3xl bg-stone-100/80 p-4">
                  <p className="text-sm text-stone-500">累计时长</p>
                  <p className="mt-2 text-2xl text-stone-950">{metrics.totalDuration ?? "0 分钟"}</p>
                </div>
                <div className="rounded-3xl bg-stone-100/80 p-4">
                  <p className="text-sm text-stone-500">新颖度</p>
                  <p className="mt-2 text-2xl text-stone-950">
                    {metrics.noveltyRatio != null ? percent(metrics.noveltyRatio) : "样本不足"}
                  </p>
                </div>
              </div>
            </Panel>

            <Panel>
              <h3 className="font-serif text-2xl text-stone-950">拆分评分</h3>
              <div className="mt-4 space-y-3">
                <div className="rounded-3xl bg-stone-100/80 p-4">
                  <p className="text-sm text-stone-500">主题收窄</p>
                  <p className="mt-2 text-xl text-stone-950">
                    {metrics.scoreBreakdown?.topicNarrowness != null
                      ? percent(metrics.scoreBreakdown.topicNarrowness)
                      : "--"}
                  </p>
                </div>
                <div className="rounded-3xl bg-stone-100/80 p-4">
                  <p className="text-sm text-stone-500">UP 主重复率</p>
                  <p className="mt-2 text-xl text-stone-950">
                    {metrics.scoreBreakdown?.authorRepetition != null
                      ? percent(metrics.scoreBreakdown.authorRepetition)
                      : "--"}
                  </p>
                </div>
                <div className="rounded-3xl bg-stone-100/80 p-4">
                  <p className="text-sm text-stone-500">分区集中度</p>
                  <p className="mt-2 text-xl text-stone-950">
                    {metrics.scoreBreakdown?.categoryConcentration != null
                      ? percent(metrics.scoreBreakdown.categoryConcentration)
                      : "--"}
                  </p>
                </div>
              </div>
            </Panel>

            <Link href="/" className="inline-flex items-center rounded-full bg-stone-900 px-4 py-3 text-sm text-stone-50">
              返回仪表盘
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
