import { describe, expect, it } from "vitest";
import { ROLES } from "./guards";
import { roleFromHeader } from "./role-header";

describe("roleFromHeader", () => {
  it.each(ROLES)("accepts the declared role %s", (role) => {
    expect(roleFromHeader(role)).toBe(role);
  });

  it.each([null, undefined, "", "admin", "student", "GESTOR", "gestor,professor"])(
    "reads %s as no role at all",
    (value) => {
      expect(roleFromHeader(value)).toBeNull();
    }
  );
});
