import type { MsgId, MsgValues } from "@/lib/i18n";
import type { FieldError } from "@/lib/validation";

/** Every API failure carries a message id, so the screen shows the same words the rule uses. */
export class ApiError extends Error {
  constructor(
    public readonly id: MsgId,
    public readonly values?: MsgValues,
    public readonly fieldErrors: FieldError[] = [],
  ) {
    super(id);
    this.name = "ApiError";
  }
}
