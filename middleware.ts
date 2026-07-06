import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/auth/admin-session";
import { VOTER_SESSION_COOKIE, verifyVoterSession } from "@/lib/auth/voter-session";

// Coarse, stateless gatekeeping: valid JWT signature + expiry only. Every
// protected Server Component / route handler re-checks the database
// (revoked? already submitted? election still open?) as the
// authoritative source of truth -- middleware alone cannot see that
// state without a DB round trip on every request at the edge.
export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/vote/:electionId/ballot", "/api/voter/ballot"],
};

const PUBLIC_ADMIN_PATHS = new Set(["/admin/login", "/api/admin/login"]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (PUBLIC_ADMIN_PATHS.has(pathname)) {
      return NextResponse.next();
    }

    const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    const session = token ? await verifyAdminSession(token) : null;

    if (!session) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  }

  const ballotPageMatch = pathname.match(/^\/vote\/([^/]+)\/ballot$/);
  if (ballotPageMatch) {
    const electionId = ballotPageMatch[1];
    const token = request.cookies.get(VOTER_SESSION_COOKIE)?.value;
    const session = token ? await verifyVoterSession(token) : null;

    if (!session || session.electionId !== electionId) {
      return NextResponse.redirect(new URL(`/vote/${electionId}`, request.url));
    }

    return NextResponse.next();
  }

  if (pathname === "/api/voter/ballot") {
    const token = request.cookies.get(VOTER_SESSION_COOKIE)?.value;
    const session = token ? await verifyVoterSession(token) : null;

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}
