import OpenAI from "openai";
import { z } from "zod";

import type { LlmTagResult, ReportPromptPayload } from "@/lib/types";
import { getDefaultLlmBaseUrl, getDefaultLlmModel } from "@/lib/env";
import { getLlmConfig } from "@/lib/server/config";

async function getClient(override?: {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}, options?: { ignoreEnabled?: boolean }) {
  const storedConfig = await getLlmConfig();
  const config = {
    ...storedConfig,
    llmBaseUrl: override?.baseUrl ?? storedConfig.llmBaseUrl ?? getDefaultLlmBaseUrl(),
    llmModel: override?.model ?? storedConfig.llmModel ?? getDefaultLlmModel(),
    apiKey: override?.apiKey ?? storedConfig.apiKey,
  };

  if (!config.apiKey || (!options?.ignoreEnabled && !config.llmEnabled)) {
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

const tagResultSchema = z.object({
  tags: z.array(z.string()).min(1),
  summary: z.string().min(1),
});

const narrativeReportSchema = z.object({
  summary: z.string().min(1),
  body: z.string().min(1),
});

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

  const payload = tagResultSchema.parse(await requestJson(
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
  const bundle = await getClient(input, { ignoreEnabled: true });

  if (!bundle) {
    throw new Error("当前没有可用的 LLM 配置，请先启用 LLM 识别并填写 API Key，或在输入框中提供临时配置。");
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

  const parsed = narrativeReportSchema.parse(await requestJson(
    bundle,
    "你是 coconon 的比较型报告助手。请根据两个时间窗口的结构化对比结果输出 JSON：{summary: string, body: string}。summary 只写一句结论。body 必须使用 Markdown，允许使用标题、粗体、列表和引用；必须明确说明当前窗口相对上一窗口是更进入信息茧房、局部收窄、基本持平还是有所扩散，并引用 2 到 4 条具体证据。若 sampleSufficient=false，必须明确写出样本不足，不要伪造总分。",
    JSON.stringify(payload),
  )) as { summary: string; body: string };

  return parsed;
}
