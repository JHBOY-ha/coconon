import { NextResponse } from "next/server";

import { runSyncJob } from "@/lib/server/jobs";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      full?: boolean;
      days?: number | string;
    };

    if (body.full) {
      const result = await runSyncJob("manual:full", { full: true });
      return NextResponse.json({
        ok: true,
        message: `全量刷新完成，新增 ${result.inserted} 条，更新 ${result.updated} 条。标签补全和日报生成需要手动触发。`,
      });
    }

    const parsedDays = Number(body.days ?? 2);
    if (!Number.isInteger(parsedDays) || parsedDays < 1 || parsedDays > 30) {
      return NextResponse.json(
        {
          ok: false,
          error: "同步天数必须是 1 到 30 之间的整数。",
        },
        { status: 400 },
      );
    }

    const result = await runSyncJob("manual", { days: parsedDays });
    return NextResponse.json({
      ok: true,
      message: `最近 ${parsedDays} 天同步完成，新增 ${result.inserted} 条，更新 ${result.updated} 条。`,
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
