"use client";

import { FarmPicker } from "@/components/ui/farm-picker";
import { useFarms } from "@/lib/api/queries";
import { tInline } from "@/lib/i18n";
import { setAdminFarm, useAdminFarm } from "./admin-farm-filter";
import { Bi } from "./bi";
import { LangOrderToggle } from "./lang-order-toggle";

/** Admin top bar. The farm filter applies to every admin screen. */
export function AdminTopBar() {
  const farms = useFarms().data ?? [];
  const farmId = useAdminFarm();

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-2">
      <label className="flex items-center gap-2 text-sm">
        <Bi id="admin.farmFilter" />
        <FarmPicker
          farms={farms}
          includeAll
          value={farmId}
          onChange={setAdminFarm}
          className="input min-h-10 w-64"
          aria-label={tInline("admin.farmFilter")}
        />
      </label>
      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-muted sm:inline">
          <Bi id="login.admin" inline />
        </span>
        <LangOrderToggle />
      </div>
    </header>
  );
}
