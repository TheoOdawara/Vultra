import { type NextRequest, NextResponse } from "next/server";
import { decideAccess } from "@/shared/auth/guards";
import { fetchSession } from "@/shared/auth/session";

export async function middleware(request: NextRequest) {
  const session = await fetchSession(request.headers.get("cookie"));
  const decision = decideAccess(request.nextUrl.pathname, session?.role ?? null);

  if (decision.outcome === "redirect") {
    return NextResponse.redirect(new URL(decision.to, request.url));
  }

  if (decision.outcome === "deny") {
    return NextResponse.rewrite(new URL("/denied", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.webmanifest|sw\\.js|.*\\..*).*)",
  ],
};
