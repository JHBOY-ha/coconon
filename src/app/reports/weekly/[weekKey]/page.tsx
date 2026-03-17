import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ComparisonReportView } from "@/components/comparison-report-view";
import { prisma } from "@/lib/prisma";
import { parseComparisonBreakdown } from "@/lib/server/reporting";
import type { WeeklyReportRecord } from "@/lib/store-types";

export default async function WeeklyReportDetailPage({
  params,
}: {
  params: Promise<{ weekKey: string }>;
}) {
  const { weekKey } = await params;
  const report = (await prisma.weeklyReport.findUnique({
    where: { weekKey },
  })) as WeeklyReportRecord | null;

  if (!report) {
    notFound();
  }

  return (
    <AppShell currentPath="/">
      <ComparisonReportView
        heading={weekKey}
        subheading="Weekly report"
        summary={report.summary}
        body={report.body}
        score={report.cocononScore}
        level={report.cocononLevel}
        comparisonLabel={report.comparisonLabel}
        comparisonTarget={report.comparisonTarget}
        breakdown={parseComparisonBreakdown(report.comparisonBreakdown)}
        evidence={JSON.parse(report.evidence) as string[]}
        backHref="/"
      />
    </AppShell>
  );
}
