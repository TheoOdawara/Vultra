import { describe, expect, it } from "vitest";
import { DENIED_MESSAGE, decideAccess, ROLE_HOME, ROLES, ROUTE_GUARDS, type Role } from "./guards";

describe("route guard map", () => {
  it("knows exactly the three roles that authenticate", () => {
    expect([...ROLES]).toEqual(["gestor", "professor", "rh"]);
  });

  it("sends each role to the landing route the spec fixed", () => {
    expect(ROLE_HOME).toEqual({
      gestor: "/members",
      professor: "/attendance",
      rh: "/reports/wellbeing",
    });
  });

  it("denies a private route nobody declared, for every role", () => {
    for (const role of ROLES) {
      expect(decideAccess("/experiments", role)).toEqual({ outcome: "deny" });
    }
  });

  it("denies an undeclared child of a declared route", () => {
    expect(decideAccess("/reports/finance", "gestor")).toEqual({ outcome: "deny" });
  });

  it("sends an anonymous visitor to login carrying where they wanted to go", () => {
    expect(decideAccess("/members", null)).toEqual({
      outcome: "redirect",
      to: "/login?next=%2Fmembers",
    });
  });

  it("lets an anonymous visitor reach the public routes", () => {
    for (const route of ["/login", "/forgot-password", "/reset-password"]) {
      expect(decideAccess(route, null)).toEqual({ outcome: "allow" });
    }
  });

  it("takes an authenticated user off the public routes to their own area", () => {
    expect(decideAccess("/login", "professor")).toEqual({
      outcome: "redirect",
      to: "/attendance",
    });
  });

  it("reads an invitation path with its identifier", () => {
    expect(decideAccess("/accept-invitation/0198c4a1", null)).toEqual({ outcome: "allow" });
  });

  it.each([
    ["/members", "gestor", "allow"],
    ["/members", "professor", "deny"],
    ["/members", "rh", "deny"],
    ["/devices", "gestor", "allow"],
    ["/devices", "professor", "deny"],
    ["/classes", "gestor", "allow"],
    ["/classes", "professor", "allow"],
    ["/classes", "rh", "deny"],
    ["/attendance", "professor", "allow"],
    ["/attendance", "rh", "deny"],
    ["/reports/attendance", "professor", "allow"],
    ["/reports/attendance", "rh", "deny"],
    ["/reports/wellbeing", "rh", "allow"],
    ["/reports/wellbeing", "professor", "deny"],
    ["/audit-logs", "gestor", "allow"],
    ["/audit-logs", "rh", "deny"],
    ["/retention", "gestor", "allow"],
    ["/biometric-profiles", "gestor", "allow"],
    ["/biometric-profiles", "professor", "deny"],
  ])("%s with role %s is %s", (pathname, role, outcome) => {
    expect(decideAccess(pathname, role as Role).outcome).toBe(outcome);
  });

  it("gives rh exactly one reachable area", () => {
    const reachable = ROUTE_GUARDS.filter((guard) => guard.roles.includes("rh"));

    expect(reachable.map((guard) => guard.prefix)).toEqual(["/reports/wellbeing"]);
  });

  it("routes the root by role instead of serving it", () => {
    expect(decideAccess("/", "gestor")).toEqual({ outcome: "redirect", to: "/members" });
    expect(decideAccess("/", null)).toEqual({ outcome: "redirect", to: "/login?next=%2F" });
  });

  it("states the denial in the words the spec fixed", () => {
    expect(DENIED_MESSAGE).toBe("Você não tem acesso a esta área.");
  });

  it("declares no route whose role list is empty", () => {
    for (const guard of ROUTE_GUARDS) {
      expect(guard.roles.length).toBeGreaterThan(0);
    }
  });
});
