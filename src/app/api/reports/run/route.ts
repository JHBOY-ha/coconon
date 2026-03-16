import { NextResponse } from "next/server";

import { runReportJob, runTagJob } from "@/lib/server/jobs";
import { formatDay } from "@/lib/utils";

export async function POST() {
  try {
    await runTagJob("manual");
    const report = await runReportJob("manual", formatDay(new Date()));

    if (!report) {
      throw new Error("日报生成后未返回结果。");
    }

    return NextResponse.json({
      ok: true,
      message: `日报已生成，当前信息茧房评分 ${report.cocoonScore} 分。`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "日报生成失败",
      },
      { status: 500 },
    );
  }
}
