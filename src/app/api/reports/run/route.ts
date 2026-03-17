import { NextResponse } from "next/server";
import { z } from "zod";

import { runReportJob } from "@/lib/server/jobs";
import { formatDay, formatWeekKey } from "@/lib/utils";

const reportRunSchema = z.object({
  period: z.enum(["daily", "weekly", "both"]).optional(),
});

export async function POST(request: Request) {
  try {
    const body = reportRunSchema.parse(await request.json().catch(() => ({})));
    const report = await runReportJob("manual", {
      period: body.period ?? "daily",
      dayKey: formatDay(new Date()),
      weekKey: formatWeekKey(new Date()),
    });

    return NextResponse.json({
      ok: true,
      message:
        body.period === "weekly"
          ? `周报已生成，当前本周 coconon score ${report.weekly?.cocononScore ?? "样本不足"}。`
          : body.period === "both"
            ? `日报和周报已生成。今日日分 ${report.daily?.cocononScore ?? "样本不足"}，本周周分 ${report.weekly?.cocononScore ?? "样本不足"}。`
            : `日报已生成，当前今日 coconon score ${report.daily?.cocononScore ?? "样本不足"}。`,
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
