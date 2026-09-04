import { describe, expect, it } from "vitest";
import { decideAccess, ROLE_HOME, ROLES, type Role } from "@/shared/auth/guards";
import { activeHrefFor, NAVIGATION, navItemsFor } from "./navigation";

const SCREEN_MAP: Record<Role, string[]> = {
  gestor: [
    "/members",
    "/classes",
    "/devices",
    "/biometric-profiles",
    "/reports/attendance",
    "/reports/wellbeing",
    "/audit-logs",
    "/retention",
  ],
  professor: ["/attendance", "/classes", "/reports/attendance"],
  rh: ["/reports/wellbeing"],
};

describe("the navigation map", () => {
  it.each(ROLES)("offers %s exactly the screens the spec maps to the role", (role) => {
    expect(navItemsFor(role).map((item) => item.href)).toEqual(SCREEN_MAP[role]);
  });

  it("gives rh a single item", () => {
    expect(navItemsFor("rh")).toHaveLength(1);
  });

  it.each(ROLES)("never offers %s a route the guard map denies it", (role) => {
    for (const item of navItemsFor(role)) {
      expect(decideAccess(item.href, role)).toEqual({ outcome: "allow" });
    }
  });

  it.each(ROLES)("keeps the home of %s reachable from its own navigation", (role) => {
    expect(navItemsFor(role).map((item) => item.href)).toContain(ROLE_HOME[role]);
  });

  it("labels every item and every group in PT-BR without an empty string", () => {
    for (const role of ROLES) {
      for (const group of NAVIGATION[role]) {
        expect(group.label === null || group.label.length > 0).toBe(true);
        for (const item of group.items) expect(item.label.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("activeHrefFor", () => {
  it("marks the item whose route is open", () => {
    expect(activeHrefFor("gestor", "/members")).toBe("/members");
  });

  it("marks the item when a child route is open", () => {
    expect(activeHrefFor("gestor", "/classes/abc")).toBe("/classes");
  });

  it("prefers the longest matching item", () => {
    expect(activeHrefFor("professor", "/reports/attendance")).toBe("/reports/attendance");
  });

  it("marks nothing when the open route is not in the navigation", () => {
    expect(activeHrefFor("gestor", "/member-imports")).toBeNull();
    expect(activeHrefFor("rh", "/members")).toBeNull();
  });
});
