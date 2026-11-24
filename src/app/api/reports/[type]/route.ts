import type { ReportFilters, ReportType } from "@/lib/api/types";
import { handler } from "@/server/route";
import { getReport } from "@/server/services/reports";

export const GET = handler<{ type: string }>("admin", ({ params, query }) =>
  getReport(params.type as ReportType, Object.fromEntries(query) as ReportFilters),
);
