import { notFound } from "next/navigation";
import { REPORTS } from "@/features/admin/report-list";
import { Reports } from "@/features/admin/reports";
import type { ReportType } from "@/lib/api";

export function generateStaticParams() {
  return REPORTS.map((type) => ({ type }));
}

// A7 — Reports: one page per report.
export default async function ReportPage({ params }: PageProps<"/admin/reports/[type]">) {
  const { type } = await params;
  if (!REPORTS.includes(type as ReportType)) notFound();
  return <Reports type={type as ReportType} />;
}
