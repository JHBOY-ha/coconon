import OpenAI from "openai";

import type { LlmTagResult, ReportPromptPayload } from "@/lib/types";
import { getLlmConfig } from "@/lib/server/config";

async function getClient() {
  const config = await getLlmConfig();

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

  const response = await bundle.client.responses.create({
    model: bundle.model,
    input: [
      {
        role: "system",
        content:
          "你是一个视频主题分类助手。请根据给定信息返回 JSON：{tags: string[], summary: string}。tags 仅返回 1 到 3 个中文短标签。",
      },
      {
        role: "user",
        content: JSON.stringify(input),
      },
    ],
  });

  const payload = extractJsonBlock(response.output_text) as LlmTagResult;

  return {
    tags: payload.tags.slice(0, 3),
    summary: payload.summary,
  };
}

export async function generateNarrativeReport(payload: ReportPromptPayload) {
  const bundle = await getClient();

  if (!bundle) {
    return null;
  }

  const response = await bundle.client.responses.create({
    model: bundle.model,
    input: [
      {
        role: "system",
        content:
          "你是 cocoon 的日报助手。请根据结构化指标输出 JSON：{summary: string, body: string}。要求简洁、具体，明确说明相比上一天是更窄、更宽还是持平，并给出 2-3 条证据。",
      },
      {
        role: "user",
        content: JSON.stringify(payload),
      },
    ],
  });

  const parsed = extractJsonBlock(response.output_text) as { summary: string; body: string };
  return parsed;
}
