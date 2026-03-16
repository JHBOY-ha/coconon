"use client";

import { useState } from "react";

type SettingsClientProps = {
  cookiePreview: string | null;
  llmBaseUrl: string | null;
  llmModel: string | null;
  syncHour: number;
  syncMinute: number;
};

export function SettingsClient(props: SettingsClientProps) {
  const [sessdata, setSessdata] = useState("");
  const [biliJct, setBiliJct] = useState("");
  const [dedeUserId, setDedeUserId] = useState("");
  const [cookieMessage, setCookieMessage] = useState<string | null>(null);
  const [cookieTesting, setCookieTesting] = useState(false);
  const [llmBaseUrl, setLlmBaseUrl] = useState(props.llmBaseUrl ?? "");
  const [llmModel, setLlmModel] = useState(props.llmModel ?? "");
  const [apiKey, setApiKey] = useState("");
  const [syncHour, setSyncHour] = useState(props.syncHour);
  const [syncMinute, setSyncMinute] = useState(props.syncMinute);
  const [llmMessage, setLlmMessage] = useState<string | null>(null);
  const [llmTesting, setLlmTesting] = useState(false);

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
    </div>
  );
}
