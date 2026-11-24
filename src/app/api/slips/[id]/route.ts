import { handler } from "@/server/route";
import { visibleSlip } from "@/server/visible";

export const GET = handler<{ id: string }>("user", ({ params, user }) => visibleSlip(user, params.id));
