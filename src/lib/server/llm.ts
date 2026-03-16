import OpenAI from "openai";

import type { LlmTagResult, ReportPromptPayload } from "@/lib/types";
import { getDefaultLlmBaseUrl, getDefaultLlmModel } from "@/lib/env";
import { getLlmConfig } from "@/lib/server/config";

async function getClient(override?: {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}) {
  const storedConfig = await getLlmConfig();
  const config = {
    ...storedConfig,
    llmBaseUrl: override?.baseUrl ?? storedConfig.llmBaseUrl ?? getDefaultLlmBaseUrl(),
    llmModel: override?.model ?? storedConfig.llmModel ?? getDefaultLlmModel(),
    apiKey: override?.apiKey ?? storedConfig.apiKey,
  };

  if (!config.apiKey) {
    return null;
  }

  return {
    client: new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.llmBaseUrl ?? undefined,
    }),
    model: config.llmModel ?? "gpt-4o-mini",
  };
}

function extractJsonBlock(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("LLM 未返回可解析 JSON。");
  }
  return JSON.parse(match[0]) as Record<string, unknown>;
}

function normalizeLlmError(error: unknown) {
  if (error instanceof Error) {
    if (error.message.includes("404 status code")) {
      return new Error(
        "当前接口不支持 OpenAI Responses API，系统已自动尝试兼容回退；如果仍失败，请检查 Base URL 和 Model 是否与供应商一致。",
      );
    }

    return error;
  }

  return new Error("LLM 请求失败。");
}

async function requestJson(
  bundle: NonNullable<Awaited<ReturnType<typeof getClient>>>,
  system: string,
  user: string,
) {
  try {
    const response = await bundle.client.responses.create({
      model: bundle.model,
      input: [
        {
          role: "system",
          content: system,
        },
        {
          role: "user",
          content: user,
        },
      ],
    });

    return extractJsonBlock(response.output_text);
  } catch {
    const completion = await bundle.client.chat.completions.create({
      model: bundle.model,
      messages: [
        {
          role: "system",
          content: system,
        },
        {
          role: "user",
          content: user,
        },
      ],
      response_format: {
        type: "json_object",
      },
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) {
      throw new Error("LLM 未返回内容。");
    }

    return extractJsonBlock(text);
  }
}

export async function enrichTagsWithLlm(input: {
  title: string;
  authorName: string | null;
  tagName: string | null;
  subTagName: string | null;
}) {
  const bundle = await getClient();

  if (!bundle) {
    return null;
  }

  const payload = (await requestJson(
    bundle,
    "你是一个视频主题分类助手。请根据给定信息返回 JSON：{tags: string[], summary: string}。tags 仅返回 1 到 3 个中文短标签。",
    JSON.stringify(input),
  )) as LlmTagResult;

  return {
    tags: payload.tags.slice(0, 3),
    summary: payload.summary,
  };
}

export async function validateLlmConfig(input?: {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}) {
  const bundle = await getClient(input);

  if (!bundle) {
    throw new Error("当前没有可用的 LLM 配置，请先填写并保存 API Key，或在输入框中提供临时配置。");
  }

  try {
    const payload = await requestJson(
      bundle,
      "Return JSON only: {\"ok\": true, \"message\": \"ping\"}",
      "ping",
    );

    return {
      ok: true,
      model: bundle.model,
      output: JSON.stringify(payload).slice(0, 120),
    };
  } catch (error) {
    throw normalizeLlmError(error);
  }
}

export async function generateNarrativeReport(payload: ReportPromptPayload) {
  const bundle = await getClient();

  if (!bundle) {
    return null;
  }

  const parsed = (await requestJson(
    bundle,
    "你是 cocoon 的日报助手。请根据结构化指标输出 JSON：{summary: string, body: string}。要求简洁、具体，明确说明相比上一天是更窄、更宽还是持平，并给出 2-3 条证据。",
    JSON.stringify(payload),
  )) as { summary: string; body: string };

  return parsed;
}
