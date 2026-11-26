import { handler } from "@/server/route";
import { rejectItemRequest } from "@/server/services/setup";

export const POST = handler<{ id: string }>("admin", async ({ params, body, user }) =>
  rejectItemRequest({ requestId: params.id, note: String((await body()).note ?? ""), by: user.name }),
);
