import type { SlipFilters } from "@/lib/api/types";
import { farmFor, handler } from "@/server/route";
import { listSlips } from "@/server/services/slips";

export const GET = handler("user", ({ query, user }) => {
  const f: SlipFilters = Object.fromEntries(query) as SlipFilters;
  return listSlips({ ...f, farmId: farmFor(user, f.farmId) });
});
