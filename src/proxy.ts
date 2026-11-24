import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: no session cookie → the login page. The real checks are in every /api route
// (src/server/route.ts) and in FarmGate / AdminGate.
export function proxy(request: NextRequest) {
  if (!request.cookies.has("awfarms_session")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/farm/:path*", "/admin/:path*", "/print/:path*", "/dev"],
};
