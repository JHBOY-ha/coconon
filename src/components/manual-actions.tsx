"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { TagJobProgress, TagQueueSummary } from "@/lib/types";
import { formatDuration } from "@/lib/utils";

type ActionButtonProps = {
  title: string;
  description: string;
  endpoint: string;
  body?: Record<string, unknown>;
};

type TagSummaryPayload = {
  queue: TagQueueSummary;
  activeJob: {
    id: string;
    progress: TagJobProgress | null;
  } | null;
};

function formatEstimate(seconds: number) {
  if (seconds <= 0) {
    return "不到 1 分钟";
  }

  return formatDuration(Math.max(1, Math.ceil(seconds / 60)));
}

function SyncHistoryCard() {
  const router = useRouter();
  const [days, setDays] = useState("7");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    const parsedDays = Number(days);

    if (!Number.isInteger(parsedDays) || parsedDays < 1 || parsedDays > 365) {
      setMessage("抓取跨度必须是 1 到 365 天之间的整数。");
      return;
    }

    setPending(true);
    setMessage(null);

    try {
      const response = await fetch("/api/sync/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ days: parsedDays }),
      });
      const payload = (await response.json()) as { message?: string; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "请求失败");
      }

      setMessage(payload.message ?? "已完成");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "执行失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-3xl bg-stone-100/80 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="font-medium text-stone-900">抓取历史记录</h3>
          <p className="mt-1 text-sm leading-6 text-stone-600">
            按选择的时间跨度回拉历史记录。跨度越长，抓取时间越久；抓取完成后仍需手动补标签和生成报告。
          </p>
        </div>
        <button
          type="button"
          onClick={handleClick}
          disabled={pending}
          className="rounded-full bg-stone-900 px-4 py-2 text-sm text-stone-50 transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-400"
        >
          {pending ? "执行中..." : "运行"}
        </button>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <div>
          <label className="block text-sm text-stone-600" htmlFor="sync-days">
            抓取时间跨度
          </label>
          <select
            id="sync-days"
            value={days}
            onChange={(event) => setDays(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-stone-900 outline-none transition focus:border-stone-900"
          >
            <option value="1">最近 1 天</option>
            <option value="3">最近 3 天</option>
            <option value="7">最近 7 天</option>
            <option value="14">最近 14 天</option>
            <option value="30">最近 30 天</option>
            <option value="90">最近 90 天</option>
            <option value="365">尽可能多</option>
          </select>
        </div>
        <p className="self-end text-sm leading-6 text-stone-600">
          “尽可能多” 会持续翻页抓取更早历史，直到命中当前内置上限或没有更多记录。
        </p>
      </div>

      {message ? <p className="mt-3 text-sm text-stone-700">{message}</p> : null}
    </div>
  );
}

function ActionButton({ title, description, endpoint, body }: ActionButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setMessage(null);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body ?? {}),
      });
      const payload = (await response.json()) as { message?: string; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "请求失败");
      }

      setMessage(payload.message ?? "已完成");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "执行失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-3xl bg-stone-100/80 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-medium text-stone-900">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-stone-600">{description}</p>
        </div>
        <button
          type="button"
          onClick={handleClick}
          disabled={pending}
          className="rounded-full bg-stone-900 px-4 py-2 text-sm text-stone-50 transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-400"
        >
          {pending ? "执行中..." : "运行"}
        </button>
      </div>
      {message ? <p className="mt-3 text-sm text-stone-700">{message}</p> : null}
    </div>
  );
}

function TagEnrichmentCard() {
  const router = useRouter();
  const hadRunningRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<TagSummaryPayload | null>(null);

  const refreshSummary = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
      }

      try {
        const response = await fetch("/api/tags/summary", {
          cache: "no-store",
        });
        const payload = (await response.json()) as {
          ok?: boolean;
          summary?: TagSummaryPayload;
          error?: string;
        };

        if (!response.ok || !payload.summary) {
          throw new Error(payload.error ?? "读取补标签状态失败");
        }

        const nextSummary = payload.summary;
        const isRunning = Boolean(nextSummary.activeJob);

        if (hadRunningRef.current && !isRunning) {
          setMessage((current) => current ?? "补标签任务已完成。");
          router.refresh();
        }

        hadRunningRef.current = isRunning;
        setSummary(nextSummary);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "读取补标签状态失败");
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [router],
  );

  useEffect(() => {
    void refreshSummary();
  }, [refreshSummary]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshSummary(true);
    }, summary?.activeJob ? 2000 : 15000);

    return () => window.clearInterval(timer);
  }, [refreshSummary, summary?.activeJob]);

  async function startTagging() {
    setStarting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/tags/run", {
        method: "POST",
      });
      const payload = (await response.json()) as {
        message?: string;
        error?: string;
        queue?: TagQueueSummary;
        job?: TagSummaryPayload["activeJob"];
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "启动补标签任务失败");
      }

      setMessage(payload.message ?? "已启动补标签任务。");
      await refreshSummary(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "启动补标签任务失败");
    } finally {
      setStarting(false);
    }
  }

  const queue = summary?.queue;
  const progress = summary?.activeJob?.progress;
  const disableStart = starting || Boolean(summary?.activeJob) || (queue?.totalPending ?? 0) === 0;

  return (
    <div className="rounded-[2rem] bg-stone-100/80 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <h3 className="font-serif text-2xl text-stone-950">LLM 补全标签</h3>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            这个任务会扫描所有待补标签的视频，规则足够时直接补齐，不够时才调用 LLM。适合在抓取历史之后单独运行。
          </p>
        </div>
        <button
          type="button"
          onClick={startTagging}
          disabled={disableStart}
          className="rounded-full bg-stone-900 px-4 py-2 text-sm text-stone-50 transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-400"
        >
          {summary?.activeJob ? "补全中..." : starting ? "启动中..." : "开始补全"}
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl bg-white/70 p-4">
          <p className="text-sm text-stone-500">待补条数</p>
          <p className="mt-2 text-2xl text-stone-950">{loading ? "--" : queue?.totalPending ?? 0}</p>
        </div>
        <div className="rounded-3xl bg-white/70 p-4">
          <p className="text-sm text-stone-500">预计调用 LLM</p>
          <p className="mt-2 text-2xl text-stone-950">{loading ? "--" : queue?.llmCandidates ?? 0}</p>
        </div>
        <div className="rounded-3xl bg-white/70 p-4">
          <p className="text-sm text-stone-500">预计补全时间</p>
          <p className="mt-2 text-2xl text-stone-950">
            {loading ? "--" : formatEstimate(queue?.estimatedSeconds ?? 0)}
          </p>
        </div>
      </div>

      {progress ? (
        <div className="mt-5 rounded-3xl bg-white/70 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-stone-900">当前进度</p>
              <p className="mt-1 text-sm text-stone-600">
                已完成 {progress.processed} / {progress.totalPending}，剩余 {progress.remaining} 条，预计还需{" "}
                {formatEstimate(progress.estimatedRemainingSeconds)}
              </p>
            </div>
            <p className="text-sm text-stone-700">{progress.percent}%</p>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-stone-200">
            <div
              className="h-full rounded-full bg-stone-900 transition-[width] duration-500"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      ) : null}

      {message ? <p className="mt-4 text-sm text-stone-700">{message}</p> : null}
    </div>
  );
}

export function ManualActions() {
  return (
    <div className="space-y-4">
      <SyncHistoryCard />
      <TagEnrichmentCard />

      <div className="grid gap-4 lg:grid-cols-2">
        <ActionButton
          title="生成今日日报"
          description="基于当前已有标签和同步结果，重新计算今日快照、评分和报告。"
          endpoint="/api/reports/run"
          body={{ period: "daily" }}
        />
        <ActionButton
          title="生成本周周报"
          description="比较本周与上周的内容结构变化，生成周维度 coconon 报告。"
          endpoint="/api/reports/run"
          body={{ period: "weekly" }}
        />
      </div>
    </div>
  );
}
