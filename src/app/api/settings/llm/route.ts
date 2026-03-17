import { NextResponse } from "next/server";
import { z } from "zod";

import { saveLlmConfig } from "@/lib/server/config";
import { ensureScheduler } from "@/lib/server/scheduler";

const llmSchema = z.object({
  baseUrl: z.string().url().optional().or(z.literal("")),
  apiKey: z.string().optional(),
  model: z.string().min(1, "模型名不能为空").optional().or(z.literal("")),
  enabled: z.boolean().optional(),
  syncHour: z.number().int().min(0).max(23).optional(),
  syncMinute: z.number().int().min(0).max(59).optional(),
});

export async function POST(request: Request) {
  try {
    const body = llmSchema.parse(await request.json());
    await saveLlmConfig({
      baseUrl: body.baseUrl || undefined,
      model: body.model || undefined,
      apiKey: body.apiKey || undefined,
      enabled: body.enabled,
      syncHour: body.syncHour,
      syncMinute: body.syncMinute,
    });

    await ensureScheduler();

    return NextResponse.json({
      ok: true,
      message: "模型配置和定时策略已保存。",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "保存设置失败",
      },
      { status: 400 },
    );
  }
}
