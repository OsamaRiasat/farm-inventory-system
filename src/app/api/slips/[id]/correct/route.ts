import type { CorrectionInput } from "@/lib/api/types";
import { handler } from "@/server/route";
import { correctSlip } from "@/server/services/corrections";

export const POST = handler<{ id: string }>("admin", async ({ params, body, user }) => {
  const b = (await body()) as Partial<CorrectionInput>;
  return correctSlip({
    slipId: params.id,
    lines: Array.isArray(b.lines) ? b.lines : [],
    reason: String(b.reason ?? ""),
    requestId: typeof b.requestId === "string" ? b.requestId : undefined,
    by: user.name,
  });
});
