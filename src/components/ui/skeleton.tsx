import { clsx } from "clsx";
import { RotateCw } from "lucide-react";
import { Bi } from "@/components/layout/bi";

/** Grey placeholder in the shape of the content. No animation, on purpose. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={clsx("rounded-lg bg-line", className)} />;
}

export function SkeletonRows({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={clsx("flex flex-col gap-3", className)} role="status" aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-14" />
      ))}
    </div>
  );
}

export function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="card flex flex-wrap items-center justify-between gap-3 border-danger bg-danger-bg p-4 text-danger">
      <Bi id="err.loadFailed" />
      <button type="button" className="btn" onClick={onRetry}>
        <RotateCw size={18} aria-hidden />
        <Bi id="common.retry" inline />
      </button>
    </div>
  );
}
