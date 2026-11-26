import { handler } from "@/server/route";
import { approveItemRequest, type ItemInput } from "@/server/services/setup";

/** Admin: create the requested item (with any changes) and close the request. */
export const POST = handler<{ id: string }>("admin", async ({ params, body, user }) => {
  const b = (await body()) as Omit<ItemInput, "id" | "by">;
  return approveItemRequest({ requestId: params.id, item: b, by: user.name });
});
