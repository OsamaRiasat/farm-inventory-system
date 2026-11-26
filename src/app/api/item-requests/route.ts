import { ApiError } from "@/lib/api/errors";
import type { ItemRequestInput } from "@/lib/api/types";
import { farmFor, handler } from "@/server/route";
import { listItemRequests, requestItem } from "@/server/services/setup";
import type { ItemRequest } from "@/types/domain";

const STATUSES: ItemRequest["status"][] = ["pending", "approved", "rejected"];

/** Admin: all farms' requests (A9 "Requested"); a Farm User: only their own farm's. */
export const GET = handler("user", ({ query, user }) => {
  const status = query.get("status") as ItemRequest["status"] | null;
  return listItemRequests({ farmId: farmFor(user, query.get("farmId")), status: status && STATUSES.includes(status) ? status : undefined });
});

/** Farm User: ask for an item that isn't in the list (client #30). Farm and name come from the session. */
export const POST = handler("user", async ({ body, user }) => {
  if (!user.farmId) throw new ApiError("err.notFound");
  const b = (await body()) as Partial<ItemRequestInput>;
  return requestItem({
    name: String(b.name ?? ""),
    nameUr: String(b.nameUr ?? ""),
    category: String(b.category ?? ""),
    unit: b.unit as ItemRequestInput["unit"],
    farmId: user.farmId,
    requestedBy: user.name,
  });
});
