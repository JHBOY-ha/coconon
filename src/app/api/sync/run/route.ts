import { NextResponse } from "next/server";

import { runFullPipeline, runSyncJob } from "@/lib/server/jobs";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { full?: boolean };

    if (body.full) {
      const result = await runFullPipeline("manual", { full: true });
      return NextResponse.json({
        ok: true,
        message: `全量同步完成，新增 ${result.sync.inserted} 条记录，并已生成今日日报。`,
      });
    }

    const result = await runSyncJob("manual");
    return NextResponse.json({
      ok: true,
      message: `同步完成，新增 ${result.inserted} 条，更新 ${result.updated} 条。`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "同步失败",
      },
      { status: 500 },
    );
  }
}
