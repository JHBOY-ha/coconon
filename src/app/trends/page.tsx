import { Activity, Layers3, Sigma, TimerReset } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Panel } from "@/components/panel";
import { getDailyTrendSummary } from "@/lib/server/trends";
import { formatDuration } from "@/lib/utils";

const TOPIC_COLORS = ["#1c1917", "#5b3416", "#9a5b23", "#d19043", "#e7c888", "#9bb298", "#b4aea6"];

function DailyCountLineChart({
  days,
}: {
  days: Array<{ label: string; totalVideos: number }>;
}) {
  const width = 760;
  const height = 260;
  const paddingX = 32;
  const paddingTop = 20;
  const paddingBottom = 42;
  const chartHeight = height - paddingTop - paddingBottom;
  const chartWidth = width - paddingX * 2;
  const maxValue = Math.max(...days.map((day) => day.totalVideos), 1);
  const stepX = days.length > 1 ? chartWidth / (days.length - 1) : 0;

  const points = days
    .map((day, index) => {
      const x = paddingX + stepX * index;
      const y = paddingTop + chartHeight - (day.totalVideos / maxValue) * chartHeight;
      return { x, y, ...day };
    })
    .map((point) => `${point.x},${point.y}`)
    .join(" ");

  const gridLines = [0.25, 0.5, 0.75, 1].map((ratio) => ({
    y: paddingTop + chartHeight - chartHeight * ratio,
    label: Math.round(maxValue * ratio),
  }));

  return (
    <div className="rounded-[1.75rem] bg-stone-100/70 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-stone-500">Daily volume</p>
          <h3 className="mt-1 font-serif text-2xl text-stone-950">每日观看条数</h3>
        </div>
        <div className="rounded-full bg-white px-4 py-2 text-sm text-stone-600">最近 {days.length} 天</div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full overflow-visible">
        {gridLines.map((line) => (
          <g key={line.label}>
            <line
              x1={paddingX}
              y1={line.y}
              x2={width - paddingX}
              y2={line.y}
              stroke="rgba(68,64,60,0.18)"
              strokeDasharray="4 6"
            />
            <text x={8} y={line.y + 4} fontSize="12" fill="#78716c">
              {line.label}
            </text>
          </g>
        ))}

        <polyline
          fill="none"
          stroke="#1c1917"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={points}
        />

        {days.map((day, index) => {
          const x = paddingX + stepX * index;
          const y = paddingTop + chartHeight - (day.totalVideos / maxValue) * chartHeight;

          return (
            <g key={day.label}>
              <circle cx={x} cy={y} r="4.5" fill="#9a5b23" stroke="#fffdf8" strokeWidth="2" />
              <text x={x} y={height - 14} textAnchor="middle" fontSize="12" fill="#78716c">
                {day.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function TopicStackedBars({
  days,
  topicLegend,
}: {
  days: Array<{
    label: string;
    topics: Array<{ label: string; share: number; count: number }>;
  }>;
  topicLegend: string[];
}) {
  const legend = topicLegend.length > 0 ? topicLegend : ["未分类"];

  return (
    <div className="rounded-[1.75rem] bg-stone-100/70 p-4">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-stone-500">Topic mix</p>
          <h3 className="mt-1 font-serif text-2xl text-stone-950">每日主题分布</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
            每列代表一天，柱体总高度固定为 100%，用来看主题结构有没有持续被少数类别吞掉。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {legend.map((label, index) => (
            <span
              key={label}
              className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs text-stone-700"
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: TOPIC_COLORS[index % TOPIC_COLORS.length] }}
              />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-3 overflow-x-auto pb-2">
        {days.map((day) => {
          const segments = legend.map((label) => day.topics.find((item) => item.label === label) ?? null);

          return (
            <div key={day.label} className="min-w-0">
              <div className="flex h-52 flex-col-reverse overflow-hidden rounded-[1.25rem] border border-stone-200 bg-white/70">
                {segments.some(Boolean) ? (
                  segments.map((segment, index) =>
                    segment ? (
                      <div
                        key={segment.label}
                        style={{
                          height: `${segment.share * 100}%`,
                          backgroundColor: TOPIC_COLORS[index % TOPIC_COLORS.length],
                        }}
                        title={`${day.label} · ${segment.label} · ${segment.count} 条`}
                      />
                    ) : null,
                  )
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-stone-400">无记录</div>
                )}
              </div>
              <p className="mt-3 text-center text-xs uppercase tracking-[0.14em] text-stone-500">{day.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default async function TrendsPage() {
  const summary = await getDailyTrendSummary({ days: 14 });
  const peakDay = [...summary.days].sort((a, b) => b.totalVideos - a.totalVideos)[0] ?? null;
  const quietDay = [...summary.days]
    .filter((day) => day.totalVideos > 0)
    .sort((a, b) => a.totalVideos - b.totalVideos)[0] ?? null;

  return (
    <AppShell currentPath="/trends">
      <div className="space-y-6">
        <Panel>
          <p className="text-sm uppercase tracking-[0.25em] text-stone-500">Daily trends</p>
          <h2 className="mt-3 font-serif text-4xl text-stone-950">每日趋势</h2>
          <p className="mt-4 max-w-3xl text-base leading-8 text-stone-600">
            用最近两周的观看条数和主题结构，看你每天刷视频的密度有没有抬高，注意力有没有持续向更少的主题倾斜。
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl bg-stone-100/80 p-4">
              <div className="flex items-center gap-3 text-stone-500">
                <Sigma className="h-4 w-4" />
                <p className="text-sm">总观看条数</p>
              </div>
              <p className="mt-3 text-3xl text-stone-950">{summary.totalVideos}</p>
            </div>
            <div className="rounded-3xl bg-stone-100/80 p-4">
              <div className="flex items-center gap-3 text-stone-500">
                <TimerReset className="h-4 w-4" />
                <p className="text-sm">估算总时长</p>
              </div>
              <p className="mt-3 text-3xl text-stone-950">{formatDuration(summary.totalMinutes)}</p>
            </div>
            <div className="rounded-3xl bg-stone-100/80 p-4">
              <div className="flex items-center gap-3 text-stone-500">
                <Activity className="h-4 w-4" />
                <p className="text-sm">日均观看条数</p>
              </div>
              <p className="mt-3 text-3xl text-stone-950">{summary.avgVideosPerDay}</p>
            </div>
            <div className="rounded-3xl bg-stone-100/80 p-4">
              <div className="flex items-center gap-3 text-stone-500">
                <Layers3 className="h-4 w-4" />
                <p className="text-sm">活跃天数</p>
              </div>
              <p className="mt-3 text-3xl text-stone-950">{summary.activeDays}</p>
            </div>
          </div>
        </Panel>

        <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
          <Panel>
            <DailyCountLineChart days={summary.days} />
          </Panel>

          <Panel>
            <p className="text-sm uppercase tracking-[0.25em] text-stone-500">Highlights</p>
            <h3 className="mt-2 font-serif text-3xl text-stone-950">高低波动日</h3>

            <div className="mt-5 space-y-4">
              <div className="rounded-[1.5rem] bg-stone-100/70 p-4">
                <p className="text-sm text-stone-500">峰值日</p>
                <p className="mt-2 text-xl text-stone-950">
                  {peakDay ? `${peakDay.dayKey} · ${peakDay.totalVideos} 条` : "暂无数据"}
                </p>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  {peakDay ? `这一天的估算观看时长约 ${formatDuration(peakDay.estimatedMinutes)}。` : "抓取历史后这里会显示最高活跃日。"}
                </p>
              </div>

              <div className="rounded-[1.5rem] bg-stone-100/70 p-4">
                <p className="text-sm text-stone-500">最低活跃日</p>
                <p className="mt-2 text-xl text-stone-950">
                  {quietDay ? `${quietDay.dayKey} · ${quietDay.totalVideos} 条` : "暂无数据"}
                </p>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  {quietDay ? `这一天的估算观看时长约 ${formatDuration(quietDay.estimatedMinutes)}。` : "如果最近没有记录，这里会保持为空。"}
                </p>
              </div>

              <div className="rounded-[1.5rem] bg-stone-900 p-4 text-stone-50">
                <p className="text-sm uppercase tracking-[0.2em] text-stone-400">Reading guide</p>
                <p className="mt-3 text-sm leading-7 text-stone-200">
                  折线图看量级波动，100% 堆积柱状图看结构变化。若后者连续多天被同两三种主题占满，比单纯观看变多更值得警惕。
                </p>
              </div>
            </div>
          </Panel>
        </div>

        <Panel>
          <TopicStackedBars days={summary.days} topicLegend={summary.topicLegend} />
        </Panel>
      </div>
    </AppShell>
  );
}
