import en from "@/messages/en.json";
import urJson from "@/messages/ur.json";

export type MsgId = keyof typeof en;
export type MsgValues = Record<string, string | number>;

// Fails type-checking if ur.json is missing a key that en.json has.
const ur: Record<MsgId, string> = urJson;

// Left-to-right isolate: keeps "26 Oct 2026" or "9,000" intact inside Urdu text.
const LRI = "⁦";
const PDI = "⁩";

function fill(text: string, values?: MsgValues, isolate = false) {
  if (!values) return text;
  return text.replace(/\{(\w+)\}/g, (match, key: string) => {
    if (!(key in values)) return match;
    return isolate ? `${LRI}${values[key]}${PDI}` : String(values[key]);
  });
}

/** Both languages for one message id. */
export function t(id: MsgId, values?: MsgValues) {
  return { en: fill(en[id], values), ur: fill(ur[id], values, true) };
}

/** One-line "English / اردو" for places that can't hold markup (option, title, aria-label). */
export function tInline(id: MsgId, values?: MsgValues) {
  const m = t(id, values);
  return `${m.en} / ${m.ur}`;
}
