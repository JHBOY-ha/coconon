import { NextResponse } from "next/server";

import { runSyncJob } from "@/lib/server/jobs";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { full?: boolean };

    if (body.full) {
      const result = await runSyncJob("manual:full", true);
      return NextResponse.json({
        ok: true,
        message: `全量刷新完成，新增 ${result.inserted} 条，更新 ${result.updated} 条。标签补全和日报生成需要手动触发。`,
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
