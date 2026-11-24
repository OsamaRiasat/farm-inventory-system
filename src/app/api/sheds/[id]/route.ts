import { handler } from "@/server/route";
import { updateShed } from "@/server/services/setup";

export const POST = handler<{ id: string }>("admin", async ({ params, body, user }) => {
  const b = await body();
  return updateShed({ id: params.id, name: String(b.name ?? ""), active: b.active !== false, by: user.name });
});
