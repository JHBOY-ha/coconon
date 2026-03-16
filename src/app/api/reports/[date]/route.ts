import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { parseDayKey } from "@/lib/utils";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ date: string }> },
) {
  const { date } = await params;
  const report = await prisma.dailyReport.findUnique({
    where: { date: parseDayKey(date) },
  });

  if (!report) {
    return NextResponse.json({ ok: false, error: "Report not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, report });
}
