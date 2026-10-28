"use client";

import { useState } from "react";
import { Bi } from "@/components/layout/bi";
import { Combobox } from "@/components/slip/combobox";
import { useSlipErrors } from "@/components/slip/slip-errors";
import { TextInput } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { useSuppliers } from "@/lib/api/queries";
import { normalizeSearch } from "@/lib/format";
import { tInline } from "@/lib/i18n";

/** "Received the following material from M/s": a past supplier (or a new name), or anyone else. Farms come in through Receive transfer. */
export function IgpSource() {
  const [kind, setKind] = useState<"supplier" | "other">("supplier");
  const label = tInline("igp.receivedFrom");
  const suppliers = useSuppliers().data ?? [];
  const msError = useSlipErrors().find((e) => e.path.join(".") === "source.ms");
  const searchSuppliers = (q: string) => suppliers.filter((s) => normalizeSearch(s).includes(normalizeSearch(q)));

  return (
    <div className="flex flex-col gap-2">
      <Segmented
        name="sourceKind"
        legend="igp.receivedFrom"
        required
        value={kind}
        onChange={setKind}
        options={[
          { value: "supplier", label: "igp.supplier" },
          { value: "other", label: "igp.other" },
        ]}
      />
      {kind === "supplier" ? (
        <>
          <Combobox
            search={searchSuppliers}
            getKey={(s) => s}
            getText={(s) => s}
            renderOption={(s) => s}
            onPick={() => {}}
            inputProps={{ name: "ms", required: true, "aria-label": label }}
          />
          <span className="text-sm text-muted">
            <Bi id="igp.typeName" inline />
          </span>
        </>
      ) : (
        <TextInput free name="ms" required aria-label={label} />
      )}
      {msError && (
        <span className="text-sm font-medium text-danger">
          <Bi id={msError.id} inline />
        </span>
      )}
    </div>
  );
}
