"use client";

import { useCurrentFarm } from "@/components/layout/farm-gate";
import { SlipDetail } from "@/features/slip-detail/slip-detail";

/** F7 — a slip of this farm only. */
export function FarmSlipDetail({ slipId, justSaved }: { slipId: string; justSaved: boolean }) {
  const { farm } = useCurrentFarm();
  return <SlipDetail slipId={slipId} mode="farm" onlyFarmId={farm.id} justSaved={justSaved} />;
}
