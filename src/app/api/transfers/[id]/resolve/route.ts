import { handler } from "@/server/route";
import { resolveShortfall } from "@/server/services/transfers";

export const POST = handler<{ id: string }>("admin", async ({ params, body, user }) =>
  resolveShortfall({ transferId: params.id, reason: String((await body()).reason ?? ""), by: user.name }),
);
