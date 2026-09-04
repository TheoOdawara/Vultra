import { HttpResponse, http } from "msw";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import type { Role } from "@/shared/auth/guards";
import { server } from "@/test/msw";
import { middleware } from "./middleware";

const API = "https://api.vultra.test";

function signedInAs(role: Role | null) {
  server.use(
    http.get(`${API}/api/auth/get-session`, () =>
      role === null
        ? new HttpResponse(null, { status: 401 })
        : HttpResponse.json({ user: { id: "u1" }, member: { role } })
    )
  );
}

function navigateTo(pathname: string, withCookie = true) {
  return new NextRequest(new URL(pathname, "https://portal.vultra.test"), {
    headers: withCookie ? { cookie: "better-auth.session_token=abc" } : {},
  });
}

describe("middleware", () => {
  it("serves a route the role declares", async () => {
    signedInAs("gestor");

    const response = await middleware(navigateTo("/members"));

    expect(response.headers.get("location")).toBe(null);
    expect(response.status).toBe(200);
  });

  it("shows the denied screen on a route the role does not declare", async () => {
    signedInAs("rh");

    const response = await middleware(navigateTo("/members"));

    expect(response.headers.get("x-middleware-rewrite")).toContain("/denied");
  });

  it("shows the denied screen on a private route nobody declared", async () => {
    signedInAs("gestor");

    const response = await middleware(navigateTo("/experiments"));

    expect(response.headers.get("x-middleware-rewrite")).toContain("/denied");
  });

  it("sends an anonymous visitor to login carrying the route wanted", async () => {
    signedInAs(null);

    const response = await middleware(navigateTo("/members", false));

    expect(response.headers.get("location")).toBe(
      "https://portal.vultra.test/login?next=%2Fmembers"
    );
  });

  it("sends each role to its own area from the root", async () => {
    for (const [role, home] of [
      ["gestor", "/members"],
      ["professor", "/attendance"],
      ["rh", "/reports/wellbeing"],
    ] as const) {
      signedInAs(role);

      const response = await middleware(navigateTo("/"));

      expect(response.headers.get("location")).toBe(`https://portal.vultra.test${home}`);
    }
  });

  it("denies when the api cannot answer who the caller is", async () => {
    server.use(http.get(`${API}/api/auth/get-session`, () => HttpResponse.error()));

    const response = await middleware(navigateTo("/members"));

    expect(response.headers.get("location")).toBe(
      "https://portal.vultra.test/login?next=%2Fmembers"
    );
  });
});
