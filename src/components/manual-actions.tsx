"use client";

import { useState } from "react";

type ActionButtonProps = {
  title: string;
  description: string;
  endpoint: string;
  body?: Record<string, unknown>;
};

function ActionButton({ title, description, endpoint, body }: ActionButtonProps) {
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

export function ManualActions() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <ActionButton
        title="同步最近观看历史"
        description="拉取最近 48 小时数据，适合日常补偿同步。"
        endpoint="/api/sync/run"
      />
      <ActionButton
        title="全量刷新一次"
        description="首次绑定 Cookie 后建议执行。会分页抓取更多历史记录，但不会自动生成日报。"
        endpoint="/api/sync/run"
        body={{ full: true }}
      />
      <ActionButton
        title="生成今日日报"
        description="基于当前数据重新计算今日快照、评分和报告。"
        endpoint="/api/reports/run"
      />
    </div>
  );
}
