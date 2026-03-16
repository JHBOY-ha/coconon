import { NextResponse } from "next/server";
import { z } from "zod";

import { validateLlmConfig } from "@/lib/server/llm";

const llmTestSchema = z.object({
  baseUrl: z.string().url().optional().or(z.literal("")),
  apiKey: z.string().optional().default(""),
  model: z.string().min(1).optional().or(z.literal("")),
});

export async function POST(request: Request) {
  try {
    const body = llmTestSchema.parse(await request.json());
    const result = await validateLlmConfig({
      baseUrl: body.baseUrl || undefined,
      apiKey: body.apiKey || undefined,
      model: body.model || undefined,
    });

    return NextResponse.json({
      ok: true,
      message: `LLM 可用，模型 ${result.model} 已返回响应。`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "LLM 测试失败",
      },
      { status: 400 },
    );
  }
}
