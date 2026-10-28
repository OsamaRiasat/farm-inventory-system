"use client";

import { useState } from "react";
import { useCurrentFarm } from "@/components/layout/farm-gate";
import { FarmPicker } from "@/components/ui/farm-picker";
import { Field, TextInput } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { useFarms } from "@/lib/api/queries";
import { tInline } from "@/lib/i18n";

/** OGP "To": another farm (becomes a transfer) or an outside party with a reason. */
export function OgpDestination() {
  const [to, setTo] = useState<"farm" | "outside">("farm");
  const [reason, setReason] = useState<"repair" | "return" | "other" | null>(null);
  const [toFarm, setToFarm] = useState("");
  const { farm } = useCurrentFarm();
  const farms = useFarms().data ?? [];

  return (
    <div className="flex flex-col gap-3">
      <Segmented
        name="toKind"
        legend="ogp.to"
        required
        value={to}
        onChange={setTo}
        options={[
          { value: "farm", label: "ogp.anotherFarm" },
          { value: "outside", label: "ogp.outside" },
        ]}
      />
      {to === "farm" ? (
        <Field label="ogp.farm" required errorPath="to.farmId">
          <FarmPicker
            name="toFarm"
            farms={farms}
            exclude={farm.id}
            value={toFarm}
            onChange={setToFarm}
            placeholder={tInline("ogp.pickFarm")}
            required
          />
        </Field>
      ) : (
        <>
          <Field label="ogp.ms" required errorPath="to.ms">
            <TextInput free name="ms" required />
          </Field>
          <Segmented
            name="reason"
            legend="ogp.reason"
            required
            value={reason}
            onChange={setReason}
            options={[
              { value: "repair", label: "ogp.repair" },
              { value: "return", label: "ogp.return" },
              { value: "other", label: "ogp.otherReason" },
            ]}
          />
        </>
      )}
    </div>
  );
}
