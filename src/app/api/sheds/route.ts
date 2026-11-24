import { handler } from "@/server/route";
import { addShed } from "@/server/services/setup";

export const POST = handler("admin", async ({ body, user }) => {
  const b = await body();
  return addShed({ farmId: String(b.farmId ?? ""), name: String(b.name ?? ""), by: user.name });
});
