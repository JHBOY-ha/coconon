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
  const [cookie, setCookie] = useState("");
  const [cookieMessage, setCookieMessage] = useState<string | null>(null);
  const [llmBaseUrl, setLlmBaseUrl] = useState(props.llmBaseUrl ?? "");
  const [llmModel, setLlmModel] = useState(props.llmModel ?? "");
  const [apiKey, setApiKey] = useState("");
  const [syncHour, setSyncHour] = useState(props.syncHour);
  const [syncMinute, setSyncMinute] = useState(props.syncMinute);
  const [llmMessage, setLlmMessage] = useState<string | null>(null);

  async function submitCookie() {
    setCookieMessage(null);
    const response = await fetch("/api/settings/cookie", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cookie }),
    });

    const payload = (await response.json()) as { message?: string; error?: string };
    setCookieMessage(payload.message ?? payload.error ?? null);

    if (response.ok) {
      setCookie("");
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

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] bg-stone-100/70 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-medium text-stone-900">Bilibili Cookie</h3>
            <p className="mt-1 text-sm leading-6 text-stone-600">
              粘贴浏览器中完整 Cookie 字符串。服务端会加密保存，仅用于拉取观看历史。
            </p>
          </div>
          <span className="rounded-full bg-stone-900 px-3 py-1 text-xs text-stone-50">
            {props.cookiePreview ?? "未配置"}
          </span>
        </div>

        <textarea
          value={cookie}
          onChange={(event) => setCookie(event.target.value)}
          rows={5}
          className="mt-4 w-full rounded-3xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none ring-0 transition focus:border-stone-900"
          placeholder="SESSDATA=...; bili_jct=...; DedeUserID=..."
        />

        <div className="mt-4 flex items-center justify-between gap-4">
          <p className="text-sm text-stone-600">{cookieMessage}</p>
          <button
            type="button"
            onClick={submitCookie}
            className="rounded-full bg-stone-900 px-4 py-2 text-sm text-stone-50"
          >
            保存 Cookie
          </button>
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
  );
}
