import { NextResponse } from "next/server";

import { startTagJob } from "@/lib/server/jobs";

export async function POST() {
  try {
    const result = await startTagJob("manual:tag");

    if (!result.started) {
      return NextResponse.json({
        ok: true,
        message:
          result.job == null
            ? "当前没有待补标签的视频。"
            : "已有补标签任务正在运行。",
        job: result.job,
        queue: result.queue,
      });
    }

    return NextResponse.json({
      ok: true,
      message:
        result.queue.totalPending > 0
          ? `已启动补标签任务，待处理 ${result.queue.totalPending} 条。`
          : "当前没有待补标签的视频。",
      job: result.job,
      queue: result.queue,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "启动补标签任务失败",
      },
      { status: 500 },
    );
  }
}
