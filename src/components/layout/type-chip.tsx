import { clsx } from "clsx";
import { ArrowDownToLine, ArrowUpFromLine, ClipboardList, type LucideIcon } from "lucide-react";
import type { SlipType } from "@/types/domain";

export const slipTypeStyle: Record<SlipType, { icon: LucideIcon; text: string; bg: string; border: string }> = {
  IGP: { icon: ArrowDownToLine, text: "text-igp", bg: "bg-igp", border: "border-igp" },
  OGP: { icon: ArrowUpFromLine, text: "text-ogp", bg: "bg-ogp", border: "border-ogp" },
  SIS: { icon: ClipboardList, text: "text-sis", bg: "bg-sis", border: "border-sis" },
};

/** C6 type chip: colour + icon + the slip's short code. */
export function TypeChip({ type, className }: { type: SlipType; className?: string }) {
  const { icon: Icon, text, border } = slipTypeStyle[type];
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border bg-surface px-2 py-0.5 text-xs font-semibold",
        text,
        border,
        className,
      )}
    >
      <Icon size={14} aria-hidden />
      {type}
    </span>
  );
}
