"use client";

import { Field, TextInput } from "@/components/ui/field";
import { REMARKS_MAX } from "@/lib/validation";

/**
 * Optional Remarks for the whole IGP / OGP, after the lines. Urdu or English.
 * `data-after-lines`: Enter in an empty item search on the last line comes here, then Enter → Save.
 */
export function RemarksField() {
  return (
    <section className="card mb-4 p-4">
      <Field label="slip.remarks" errorPath="remarks">
        <TextInput name="remarks" free maxLength={REMARKS_MAX} data-after-lines />
      </Field>
    </section>
  );
}
