import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Panel } from "@/components/panel";
import type { ComparisonBreakdown, ComparisonDimension } from "@/lib/types";
import { percent, signedPercent } from "@/lib/utils";

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

  return <span className={`rounded-full px-3 py-1 text-sm ${palette}`}>{level}风险 · {score} 分</span>;
}

function DimensionCard({ dimension }: { dimension: ComparisonDimension }) {
  return (
    <div className="rounded-3xl bg-stone-100/80 p-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-stone-500">{dimension.label}</p>
        <p className="text-sm text-stone-700">{dimension.direction}</p>
      </div>
      <p className="mt-2 text-xl text-stone-950">
        {dimension.current == null || dimension.previous == null
          ? "样本不足"
          : `${percent(dimension.current)} / ${percent(dimension.previous)}`}
      </p>
      <p className="mt-1 text-sm text-stone-600">
        {dimension.delta == null ? "无可用变化值" : `变化 ${signedPercent(dimension.delta)}`}
      </p>
      <p className="mt-2 text-sm text-stone-600">贡献分 {dimension.scoreContribution.toFixed(1)}</p>
    </div>
  );
}

export function ComparisonReportView({
  heading,
  subheading,
  summary,
  body,
  score,
  level,
  comparisonLabel,
  comparisonTarget,
  breakdown,
  evidence,
  backHref,
}: {
  heading: string;
  subheading: string;
  summary: string;
  body: string;
  score: number | null;
  level: string | null;
  comparisonLabel: string;
  comparisonTarget: string;
  breakdown: ComparisonBreakdown;
  evidence: string[];
  backHref: string;
}) {
  return (
    <div className="space-y-6">
      <Panel>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-stone-500">{subheading}</p>
            <h2 className="mt-3 font-serif text-4xl text-stone-950">{heading}</h2>
            <p className="mt-4 max-w-3xl text-base leading-8 text-stone-600">{summary}</p>
          </div>
          <div className="rounded-[1.75rem] bg-stone-900 px-5 py-4 text-stone-50">
            <p className="text-sm uppercase tracking-[0.2em] text-stone-400">coconon score</p>
            <p className="mt-2 text-3xl">{score ?? "--"}</p>
            <p className="mt-1 text-sm text-stone-300">{comparisonLabel} · 对比 {comparisonTarget}</p>
          </div>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel>
          <div className="flex items-center gap-3">
            <ScoreBadge score={score} level={level} />
            {breakdown.sampleMessage ? <span className="text-sm text-stone-500">{breakdown.sampleMessage}</span> : null}
          </div>

          <div className="report-markdown mt-6 text-base leading-8 text-stone-700">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: (props) => (
                  <a
                    {...props}
                    className="font-medium text-stone-900 underline decoration-stone-400 underline-offset-4"
                    target="_blank"
                    rel="noreferrer"
                  />
                ),
                code: ({ children, ...props }) => {
                  const isInline = !String(props.className ?? "").includes("language-");

                  if (isInline) {
                    return (
                      <code className="rounded-md bg-stone-100 px-1.5 py-1 font-mono text-[0.92em] text-stone-900">
                        {children}
                      </code>
                    );
                  }

                  return (
                    <code className="block overflow-x-auto rounded-2xl bg-stone-900 p-4 font-mono text-sm text-stone-100">
                      {children}
                    </code>
                  );
                },
              }}
            >
              {body}
            </ReactMarkdown>
          </div>

          <div className="mt-8 border-t border-stone-200 pt-6">
            <h3 className="font-serif text-2xl text-stone-950">关键证据</h3>
            <div className="mt-4 space-y-3">
              {evidence.map((entry) => (
                <div key={entry} className="rounded-3xl bg-stone-100/80 p-4 text-sm leading-7 text-stone-700">
                  {entry}
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel>
            <h3 className="font-serif text-2xl text-stone-950">维度拆解卡</h3>
            <div className="mt-4 grid gap-3">
              {breakdown.dimensions.map((dimension) => (
                <DimensionCard key={dimension.key} dimension={dimension} />
              ))}
            </div>
          </Panel>

          <Panel>
            <h3 className="font-serif text-2xl text-stone-950">窗口摘要</h3>
            <div className="mt-4 space-y-3">
              <div className="rounded-3xl bg-stone-100/80 p-4">
                <p className="text-sm text-stone-500">当前窗口</p>
                <p className="mt-2 text-base text-stone-950">{breakdown.current.label}</p>
                <p className="mt-1 text-sm text-stone-600">
                  {breakdown.current.totalVideos} 条 · {breakdown.current.totalDurationMinutes} 分钟 · 平均 {breakdown.current.avgDurationMinutes.toFixed(1)} 分钟/条
                </p>
              </div>
              <div className="rounded-3xl bg-stone-100/80 p-4">
                <p className="text-sm text-stone-500">对照窗口</p>
                <p className="mt-2 text-base text-stone-950">{breakdown.previous.label}</p>
                <p className="mt-1 text-sm text-stone-600">
                  {breakdown.previous.totalVideos} 条 · {breakdown.previous.totalDurationMinutes} 分钟 · 平均 {breakdown.previous.avgDurationMinutes.toFixed(1)} 分钟/条
                </p>
              </div>
            </div>
          </Panel>

          <Link href={backHref} className="inline-flex items-center rounded-full bg-stone-900 px-4 py-3 text-sm text-stone-50">
            返回仪表盘
          </Link>
        </div>
      </div>
    </div>
  );
}
