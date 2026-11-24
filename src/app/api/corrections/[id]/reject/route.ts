import { handler } from "@/server/route";
import { rejectCorrection } from "@/server/services/corrections";

export const POST = handler<{ id: string }>("admin", async ({ params, body, user }) =>
  rejectCorrection({ requestId: params.id, note: String((await body()).note ?? ""), by: user.name }),
);
