import { NextResponse } from "next/server";
import { z } from "zod";

import { validateBiliCookie } from "@/lib/server/bilibili";

const cookieTestSchema = z.object({
  sessdata: z.string().optional().default(""),
  biliJct: z.string().optional().default(""),
  dedeUserId: z.string().optional().default(""),
});

export async function POST(request: Request) {
  try {
    const body = cookieTestSchema.parse(await request.json());
    const result = await validateBiliCookie(body);

    return NextResponse.json({
      ok: true,
      message: `Cookie 可用，已成功访问观看历史接口，本次返回 ${result.itemCount} 条记录。`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Cookie 测试失败",
      },
      { status: 400 },
    );
  }
}
