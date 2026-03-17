import { NextResponse } from "next/server";

import { getTagQueueOverview } from "@/lib/server/jobs";

export async function GET() {
  try {
    const summary = await getTagQueueOverview();
    return NextResponse.json({
      ok: true,
      summary,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "读取补标签状态失败",
      },
      { status: 500 },
    );
  }
}
