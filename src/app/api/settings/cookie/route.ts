import { NextResponse } from "next/server";
import { z } from "zod";

import { saveBiliCookie } from "@/lib/server/config";

const cookieSchema = z.object({
  cookie: z
    .string()
    .min(10, "Cookie 内容太短")
    .refine((value) => value.includes("SESSDATA="), "Cookie 必须包含 SESSDATA。"),
});

export async function POST(request: Request) {
  try {
    const body = cookieSchema.parse(await request.json());
    await saveBiliCookie(body.cookie);

    return NextResponse.json({
      ok: true,
      message: "Cookie 已保存并加密。接下来建议先执行一次全量同步。",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "保存 Cookie 失败",
      },
      { status: 400 },
    );
  }
}
