import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ weekKey: string }> },
) {
  const { weekKey } = await params;
  const report = await prisma.weeklyReport.findUnique({
    where: { weekKey },
  });

  if (!report) {
    return NextResponse.json({ ok: false, error: "Report not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, report });
}
