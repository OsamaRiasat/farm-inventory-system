import { handler } from "@/server/route";
import { cancelSlip } from "@/server/services/corrections";

export const POST = handler<{ id: string }>("admin", async ({ params, body, user }) =>
  cancelSlip({ slipId: params.id, reason: String((await body()).reason ?? ""), by: user.name }),
);
