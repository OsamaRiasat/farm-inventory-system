import type { ReportType } from "@/lib/api";

/** The eight reports from the requirements, in menu order. */
export const REPORTS: ReportType[] = [
  "stock-on-hand",
  "item-stock-card",
  "consumption",
  "feed-mortality",
  "gate-register",
  "transfers",
  "out-for-repair",
  "corrections",
];
