import { NextResponse } from "next/server";

import { runSyncJob } from "@/lib/server/jobs";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      full?: boolean;
      days?: number | string;
    };

    const parsedDays = body.full ? 365 : Number(body.days ?? 2);
    if (!Number.isInteger(parsedDays) || parsedDays < 1 || parsedDays > 365) {
      return NextResponse.json(
        {
          ok: false,
          error: "抓取跨度必须是 1 到 365 天之间的整数。",
        },
        { status: 400 },
      );
    }

    const result = await runSyncJob(body.full ? "manual:full" : "manual", {
      full: body.full,
      days: parsedDays,
    });
    return NextResponse.json({
      ok: true,
      message: body.full
        ? result.hitPageLimit
          ? `已抓取尽可能多的历史记录，新增 ${result.inserted} 条，更新 ${result.updated} 条。已达到当前抓取上限，标签补全和日报生成需要手动触发。`
          : `已抓取尽可能多的历史记录，新增 ${result.inserted} 条，更新 ${result.updated} 条。标签补全和日报生成需要手动触发。`
        : result.hitPageLimit
          ? `最近 ${parsedDays} 天抓取完成，新增 ${result.inserted} 条，更新 ${result.updated} 条。已达到当前抓取上限，可能还未覆盖到更早记录。`
          : `最近 ${parsedDays} 天抓取完成，新增 ${result.inserted} 条，更新 ${result.updated} 条。`,
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
