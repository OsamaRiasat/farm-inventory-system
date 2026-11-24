import { handler } from "@/server/route";
import { cancelReturn } from "@/server/services/returns";

export const POST = handler<{ id: string }>("admin", async ({ params, body, user }) =>
  cancelReturn({ returnId: params.id, reason: String((await body()).reason ?? ""), by: user.name }),
);
