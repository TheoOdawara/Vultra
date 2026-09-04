import { describe, expect, it } from "vitest";
import { resolveDestination } from "./destination";
import { ROLE_HOME } from "./guards";

describe("resolveDestination", () => {
  it("falls back to the role home when next is absent or empty", () => {
    expect(resolveDestination(null, "professor")).toBe(ROLE_HOME.professor);
    expect(resolveDestination(undefined, "gestor")).toBe(ROLE_HOME.gestor);
    expect(resolveDestination("", "rh")).toBe(ROLE_HOME.rh);
  });

  it("keeps next when the route belongs to the role", () => {
    expect(resolveDestination("/members", "gestor")).toBe("/members");
    expect(resolveDestination("/reports/wellbeing", "rh")).toBe("/reports/wellbeing");
  });

  it("preserves the query string of an allowed next", () => {
    expect(resolveDestination("/members?page=2&q=ana", "gestor")).toBe("/members?page=2&q=ana");
  });

  it("falls back to the role home when next belongs to another role", () => {
    expect(resolveDestination("/members", "professor")).toBe(ROLE_HOME.professor);
    expect(resolveDestination("/audit-logs", "rh")).toBe(ROLE_HOME.rh);
  });

  it("falls back to the role home when next declares no role at all", () => {
    expect(resolveDestination("/undeclared", "gestor")).toBe(ROLE_HOME.gestor);
  });

  it("falls back to the role home for a public route", () => {
    expect(resolveDestination("/login", "gestor")).toBe(ROLE_HOME.gestor);
  });

  it.each([
    "https://evil.test/members",
    "//evil.test/members",
    String.raw`/\evil.test/members`,
    String.raw`\\evil.test/members`,
    "javascript:alert(1)",
    "members",
  ])("refuses %s as an off-site destination", (next) => {
    expect(resolveDestination(next, "gestor")).toBe(ROLE_HOME.gestor);
  });
});
