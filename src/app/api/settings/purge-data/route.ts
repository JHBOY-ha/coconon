import { NextResponse } from "next/server";

import { purgeContentData } from "@/lib/prisma";

export async function POST() {
  try {
    await purgeContentData();

    return NextResponse.json({
      ok: true,
      message: "已删除观看历史、标签、快照、日报和任务记录。",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "删除数据失败",
      },
      { status: 400 },
    );
  }
}
