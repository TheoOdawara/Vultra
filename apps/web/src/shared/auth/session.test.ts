import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/msw";
import { fetchSession } from "./session";

const API = "https://api.vultra.test";
const COOKIE = "better-auth.session_token=abc";

function sessionRoute(resolver: Parameters<typeof http.get>[1]) {
  server.use(http.get(`${API}/api/auth/get-session`, resolver));
}

describe("fetchSession", () => {
  it("reads the role of the active member", async () => {
    sessionRoute(() => HttpResponse.json({ user: { id: "u1" }, member: { role: "professor" } }));

    expect(await fetchSession(COOKIE)).toEqual({ userId: "u1", role: "professor" });
  });

  it("forwards the cookie of the browser", async () => {
    let seen: string | null = null;
    sessionRoute(({ request }) => {
      seen = request.headers.get("cookie");
      return HttpResponse.json({ user: { id: "u1" }, member: { role: "gestor" } });
    });

    await fetchSession(COOKIE);

    expect(seen).toBe(COOKIE);
  });

  it("does not spend a request when the browser carries no cookie", async () => {
    expect(await fetchSession(null)).toBe(null);
    expect(await fetchSession("")).toBe(null);
  });

  it("denies when the session has no member, so a user without role is nobody", async () => {
    sessionRoute(() => HttpResponse.json({ user: { id: "u1" } }));

    expect(await fetchSession(COOKIE)).toBe(null);
  });

  it("denies a role the client does not know", async () => {
    sessionRoute(() => HttpResponse.json({ user: { id: "u1" }, member: { role: "admin" } }));

    expect(await fetchSession(COOKIE)).toBe(null);
  });

  it("denies on 401", async () => {
    sessionRoute(() => new HttpResponse(null, { status: 401 }));

    expect(await fetchSession(COOKIE)).toBe(null);
  });

  it("denies when the api is unreachable instead of letting the request through", async () => {
    sessionRoute(() => HttpResponse.error());

    expect(await fetchSession(COOKIE)).toBe(null);
  });

  it("denies a body that is not json", async () => {
    sessionRoute(() => HttpResponse.text("<html>502</html>", { status: 200 }));

    expect(await fetchSession(COOKIE)).toBe(null);
  });
});
