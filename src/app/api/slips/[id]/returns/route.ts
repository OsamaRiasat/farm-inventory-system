import { handler } from "@/server/route";
import { listReturns } from "@/server/services/returns";
import { visibleSlip } from "@/server/visible";

export const GET = handler<{ id: string }>("user", async ({ params, user }) => {
  await visibleSlip(user, params.id);
  return listReturns(params.id);
});
