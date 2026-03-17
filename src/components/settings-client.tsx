"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type SettingsClientProps = {
  cookiePreview: string | null;
  llmBaseUrl: string | null;
  llmModel: string | null;
  llmEnabled: boolean;
  syncHour: number;
  syncMinute: number;
  defaultLlmBaseUrl: string;
  defaultLlmModel: string;
};

export function SettingsClient(props: SettingsClientProps) {
  const router = useRouter();
  const [sessdata, setSessdata] = useState("");
  const [biliJct, setBiliJct] = useState("");
  const [dedeUserId, setDedeUserId] = useState("");
  const [cookieMessage, setCookieMessage] = useState<string | null>(null);
  const [cookieTesting, setCookieTesting] = useState(false);
  const [llmBaseUrl, setLlmBaseUrl] = useState(props.llmBaseUrl ?? "");
  const [llmModel, setLlmModel] = useState(props.llmModel ?? "");
  const [llmEnabled, setLlmEnabled] = useState(props.llmEnabled);
  const [apiKey, setApiKey] = useState("");
  const [syncHour, setSyncHour] = useState(props.syncHour);
  const [syncMinute, setSyncMinute] = useState(props.syncMinute);
  const [llmMessage, setLlmMessage] = useState<string | null>(null);
  const [llmTesting, setLlmTesting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [purging, setPurging] = useState(false);
  const [dangerMessage, setDangerMessage] = useState<string | null>(null);

  async function submitCookie() {
    setCookieMessage(null);
    const response = await fetch("/api/settings/cookie", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessdata,
        biliJct,
        dedeUserId,
      }),
    });

    const payload = (await response.json()) as { message?: string; error?: string };
    setCookieMessage(payload.message ?? payload.error ?? null);

    if (response.ok) {
      setSessdata("");
      setBiliJct("");
      setDedeUserId("");
    }
  }

  async function submitLlm() {
    setLlmMessage(null);
    const response = await fetch("/api/settings/llm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: llmBaseUrl,
          model: llmModel,
          apiKey,
          enabled: llmEnabled,
          syncHour,
          syncMinute,
        }),
    });

    const payload = (await response.json()) as { message?: string; error?: string };
    setLlmMessage(payload.message ?? payload.error ?? null);

    if (response.ok) {
      setApiKey("");
    }
  }

  async function testCookie() {
    setCookieTesting(true);
    setCookieMessage(null);

    try {
      const response = await fetch("/api/settings/cookie/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessdata,
          biliJct,
          dedeUserId,
        }),
      });

      const payload = (await response.json()) as { message?: string; error?: string };
      setCookieMessage(payload.message ?? payload.error ?? null);
    } finally {
      setCookieTesting(false);
    }
  }

  async function testLlm() {
    setLlmTesting(true);
    setLlmMessage(null);

    try {
      const response = await fetch("/api/settings/llm/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: llmBaseUrl,
          model: llmModel,
          apiKey,
        }),
      });

      const payload = (await response.json()) as { message?: string; error?: string };
      setLlmMessage(payload.message ?? payload.error ?? null);
    } finally {
      setLlmTesting(false);
    }
  }

  async function resetSettings() {
    if (!window.confirm("这会清空当前保存的 Cookie、LLM 配置和调度设置。确定继续吗？")) {
      return;
    }

    setResetting(true);
    setDangerMessage(null);
    setCookieMessage(null);
    setLlmMessage(null);

    try {
      const response = await fetch("/api/settings/reset", {
        method: "POST",
      });
      const payload = (await response.json()) as { message?: string; error?: string };
      const message = payload.message ?? payload.error ?? null;

      setDangerMessage(message);

      if (response.ok) {
        setSessdata("");
        setBiliJct("");
        setDedeUserId("");
        setLlmBaseUrl(props.defaultLlmBaseUrl);
        setLlmModel(props.defaultLlmModel);
        setApiKey("");
        setLlmEnabled(true);
        setSyncHour(1);
        setSyncMinute(0);
        router.refresh();
      }
    } finally {
      setResetting(false);
    }
  }

  async function purgeData() {
    if (!window.confirm("这会删除观看历史、标签、日报、快照和任务记录，且无法恢复。确定继续吗？")) {
      return;
    }

    setPurging(true);
    setDangerMessage(null);

    try {
      const response = await fetch("/api/settings/purge-data", {
        method: "POST",
      });
      const payload = (await response.json()) as { message?: string; error?: string };
      setDangerMessage(payload.message ?? payload.error ?? null);

      if (response.ok) {
        router.refresh();
      }
    } finally {
      setPurging(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] bg-stone-100/70 p-5">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium text-stone-900">Bilibili Cookie</h3>
            <p className="mt-1 text-sm leading-6 text-stone-600">
              分开填写关键字段。服务端会自动组装为 Cookie 并加密保存，仅用于拉取观看历史。
            </p>
          </div>
          <div className="rounded-3xl bg-stone-900 px-4 py-3 text-sm text-stone-50">
            <p className="text-[11px] uppercase tracking-[0.25em] text-stone-400">Current preview</p>
            <p className="mt-2 break-all leading-6 text-stone-100">
              {props.cookiePreview ?? "未配置"}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm text-stone-600">SESSDATA</span>
            <input
              value={sessdata}
              onChange={(event) => setSessdata(event.target.value)}
              className="w-full rounded-full border border-stone-300 bg-white px-4 py-3 text-sm"
              placeholder="必填"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-stone-600">bili_jct</span>
            <input
              value={biliJct}
              onChange={(event) => setBiliJct(event.target.value)}
              className="w-full rounded-full border border-stone-300 bg-white px-4 py-3 text-sm"
              placeholder="推荐填写"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-stone-600">DedeUserID</span>
            <input
              value={dedeUserId}
              onChange={(event) => setDedeUserId(event.target.value)}
              className="w-full rounded-full border border-stone-300 bg-white px-4 py-3 text-sm"
              placeholder="推荐填写"
            />
          </label>
        </div>

        <p className="mt-4 text-sm leading-6 text-stone-500">
          至少需要 `SESSDATA`。如果同时填 `bili_jct` 和 `DedeUserID`，后续排查登录态问题会更方便。
        </p>

        <div className="mt-4 flex items-center justify-between gap-4">
          <p className="text-sm text-stone-600">{cookieMessage}</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={testCookie}
              disabled={cookieTesting}
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 disabled:cursor-not-allowed disabled:text-stone-400"
            >
              {cookieTesting ? "测试中..." : "测试 Cookie"}
            </button>
            <button
              type="button"
              onClick={submitCookie}
              className="rounded-full bg-stone-900 px-4 py-2 text-sm text-stone-50"
            >
              保存 Cookie
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-[2rem] bg-stone-100/70 p-5">
        <h3 className="text-lg font-medium text-stone-900">LLM 与调度</h3>
        <p className="mt-1 text-sm leading-6 text-stone-600">
          用于补主题标签和生成日报文字。若未配置 API Key，系统会自动回退到模板文案。
        </p>

        <div className="mt-4 flex items-center justify-between rounded-3xl bg-white/70 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-stone-900">启用 LLM 识别</p>
            <p className="mt-1 text-sm text-stone-500">关闭后将停用 LLM 标签补全和 LLM 日报文案，系统只使用规则和模板。</p>
          </div>
          <button
            type="button"
            aria-pressed={llmEnabled}
            onClick={() => setLlmEnabled((value) => !value)}
            className={`relative h-8 w-14 rounded-full transition ${llmEnabled ? "bg-stone-900" : "bg-stone-300"}`}
          >
            <span
              className={`absolute top-1 h-6 w-6 rounded-full bg-white transition ${llmEnabled ? "left-7" : "left-1"}`}
            />
          </button>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm text-stone-600">Base URL</span>
            <input
              value={llmBaseUrl}
              onChange={(event) => setLlmBaseUrl(event.target.value)}
              className="w-full rounded-full border border-stone-300 bg-white px-4 py-3 text-sm"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-stone-600">Model</span>
            <input
              value={llmModel}
              onChange={(event) => setLlmModel(event.target.value)}
              className="w-full rounded-full border border-stone-300 bg-white px-4 py-3 text-sm"
            />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm text-stone-600">API Key</span>
            <input
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              className="w-full rounded-full border border-stone-300 bg-white px-4 py-3 text-sm"
              placeholder="sk-..."
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-stone-600">定时小时</span>
            <input
              type="number"
              min={0}
              max={23}
              value={syncHour}
              onChange={(event) => setSyncHour(Number(event.target.value))}
              className="w-full rounded-full border border-stone-300 bg-white px-4 py-3 text-sm"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-stone-600">定时分钟</span>
            <input
              type="number"
              min={0}
              max={59}
              value={syncMinute}
              onChange={(event) => setSyncMinute(Number(event.target.value))}
              className="w-full rounded-full border border-stone-300 bg-white px-4 py-3 text-sm"
            />
          </label>
        </div>

        <div className="mt-4 flex items-center justify-between gap-4">
          <p className="text-sm text-stone-600">{llmMessage}</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={testLlm}
              disabled={llmTesting}
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 disabled:cursor-not-allowed disabled:text-stone-400"
            >
              {llmTesting ? "测试中..." : "测试 LLM"}
            </button>
            <button
              type="button"
              onClick={submitLlm}
              className="rounded-full bg-stone-900 px-4 py-2 text-sm text-stone-50"
            >
              保存设置
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-[2rem] border border-red-200 bg-red-50/70 p-5">
        <h3 className="text-lg font-medium text-red-900">危险操作</h3>
        <p className="mt-2 text-sm text-red-700">{dangerMessage}</p>

        <div className="mt-4 space-y-3">
          <div className="flex flex-col gap-3 rounded-3xl border border-red-200 bg-white/60 px-4 py-4 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-medium text-red-900">删除日报和历史记录</p>
              <p className="mt-1 text-sm leading-6 text-red-700">
                清空观看历史、标签、每日快照、日报和任务记录。
              </p>
            </div>
            <button
              type="button"
              onClick={purgeData}
              disabled={purging}
              className="rounded-full border border-red-300 bg-red-100 px-4 py-2 text-sm text-red-700 disabled:cursor-not-allowed disabled:text-red-300"
            >
              {purging ? "删除中..." : "删除日报和历史记录"}
            </button>
          </div>

          <div className="flex flex-col gap-3 rounded-3xl border border-red-200 bg-white/60 px-4 py-4 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-medium text-red-900">恢复默认设置</p>
              <p className="mt-1 text-sm leading-6 text-red-700">
                清空当前保存的 Cookie、LLM 配置和调度设置。
              </p>
            </div>
            <button
              type="button"
              onClick={resetSettings}
              disabled={resetting}
              className="rounded-full border border-red-300 bg-red-100 px-4 py-2 text-sm text-red-700 disabled:cursor-not-allowed disabled:text-red-300"
            >
              {resetting ? "恢复中..." : "恢复默认设置"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
