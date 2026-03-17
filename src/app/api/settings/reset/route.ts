import { NextResponse } from "next/server";

import { resetApplicationSettings } from "@/lib/server/config";
import { ensureScheduler } from "@/lib/server/scheduler";

export async function POST() {
  try {
    await resetApplicationSettings();
    await ensureScheduler();

    return NextResponse.json({
      ok: true,
      message: "已恢复默认设置，当前 Cookie 和 LLM 配置已清空。",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "恢复默认设置失败",
      },
      { status: 400 },
    );
  }
}
