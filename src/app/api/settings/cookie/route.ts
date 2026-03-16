import { NextResponse } from "next/server";
import { z } from "zod";

import { buildBiliCookie, saveBiliCookie } from "@/lib/server/config";

const splitCookieSchema = z.object({
  sessdata: z.string().min(10, "请填写 SESSDATA。"),
  biliJct: z.string().optional().default(""),
  dedeUserId: z.string().optional().default(""),
});

const rawCookieSchema = z.object({
  cookie: z
    .string()
    .min(10, "Cookie 内容太短")
    .refine((value) => value.includes("SESSDATA="), "Cookie 必须包含 SESSDATA。"),
});

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const body =
      "cookie" in payload
        ? rawCookieSchema.parse(payload)
        : splitCookieSchema.parse(payload);
    const cookie =
      "cookie" in body
        ? body.cookie
        : buildBiliCookie({
            sessdata: body.sessdata,
            biliJct: body.biliJct,
            dedeUserId: body.dedeUserId,
          });

    await saveBiliCookie(cookie);

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
