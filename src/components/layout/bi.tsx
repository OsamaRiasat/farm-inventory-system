import { clsx } from "clsx";
import { t, type MsgId, type MsgValues } from "@/lib/i18n";

type Props = {
  id: MsgId;
  values?: MsgValues;
  /** Side by side ("Save محفوظ کریں") instead of stacked. */
  inline?: boolean;
  className?: string;
};

/** C5 bilingual label: English and Urdu together; order follows the user's setting. */
export function Bi({ id, values, inline, className }: Props) {
  const { en, ur } = t(id, values);
  return (
    <span className={clsx("bi", inline && "bi-inline", className)}>
      <span lang="en">{en}</span>
      <span lang="ur" dir="rtl">
        {ur}
      </span>
    </span>
  );
}
