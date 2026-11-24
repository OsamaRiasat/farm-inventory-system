import { handler } from "@/server/route";
import { updateFarm, type FarmPatch } from "@/server/services/setup";

export const POST = handler<{ id: string }>("admin", async ({ params, body, user }) =>
  updateFarm({ ...((await body()) as FarmPatch), id: params.id, by: user.name }),
);
