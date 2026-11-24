import { handler } from "@/server/route";
import { returnUnused } from "@/server/services/returns";
import { visibleSlip } from "@/server/visible";

export const POST = handler("user", async ({ body, user }) => {
  const b = await body();
  const sis = await visibleSlip(user, String(b.sisId ?? ""), { ownOnly: true });
  return returnUnused({ ...b, sisId: sis.id, by: user.name });
});
