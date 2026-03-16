import { NextResponse } from "next/server";

import { getDashboardSummary } from "@/lib/server/dashboard";

export async function GET() {
  const summary = await getDashboardSummary();
  return NextResponse.json({ ok: true, summary });
}
