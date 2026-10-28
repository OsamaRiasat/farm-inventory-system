import { clsx } from "clsx";
import { Ban, Check, PencilLine, TriangleAlert, Truck, type LucideIcon } from "lucide-react";
import type { MsgId } from "@/lib/i18n";
import { Bi } from "./bi";

export type Status = "saved" | "corrected" | "cancelled" | "in_transit" | "received" | "short";

const styles: Record<Status, { icon: LucideIcon; className: string; label: MsgId }> = {
  saved: { icon: Check, className: "border-primary text-primary", label: "status.saved" },
  corrected: { icon: PencilLine, className: "border-sis text-sis", label: "status.corrected" },
  cancelled: { icon: Ban, className: "border-danger bg-danger-bg text-danger", label: "status.cancelled" },
  in_transit: { icon: Truck, className: "border-ogp text-ogp", label: "status.in_transit" },
  received: { icon: Check, className: "border-primary text-primary", label: "status.received" },
  short: { icon: TriangleAlert, className: "border-warning bg-warning-bg text-warning", label: "status.short" },
};

/** C7 status chip: colour + icon + word, never colour alone. */
export function StatusChip({ status, className }: { status: Status; className?: string }) {
  const { icon: Icon, className: tone, label } = styles[status];
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full border bg-surface px-2 text-xs font-semibold whitespace-nowrap", tone, className)}>
      <Icon size={14} aria-hidden className="shrink-0" />
      <Bi id={label} inline className="flex-nowrap" />
    </span>
  );
}
