/**
 * VULTRA Admin Portal — Route Protection Middleware
 *
 * - (auth)/* routes: redirect to /dashboard if already logged in
 * - /dashboard/* routes: redirect to /login if no session
 * - /: redirect to /dashboard (handled by app/page.tsx server redirect)
 *
 * Better Auth session is validated server-side via betterFetch.
 */

import { NextRequest, NextResponse } from "next/server";
import { betterFetch } from "@better-fetch/fetch";

type Session = {
  user: { id: string; email: string; name: string };
  session: { id: string };
};

const PUBLIC_PATHS = ["/login"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const apiBase =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

  const { data: session } = await betterFetch<Session>(
    `${apiBase}/api/auth/get-session`,
    {
      headers: { cookie: request.headers.get("cookie") ?? "" },
    }
  );

  const isAuthenticated = !!session?.user;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!isAuthenticated && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isAuthenticated && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
