import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseUrlState, toSearchParams, touchesFilters, withoutPagination } from "./url-state";

const membersSchema = z.object({
  search: z.string().default(""),
  role: z.enum(["gestor", "professor", "rh", "student"]).default("student"),
  sort: z.enum(["fullName", "createdAt"]).default("fullName"),
  cursor: z.string().optional(),
  cursorStack: z.string().optional(),
});

const DEFAULTS = membersSchema.parse({});

describe("parseUrlState", () => {
  it("reads every declared parameter from the url", () => {
    const params = new URLSearchParams("search=ana&role=professor&sort=createdAt&cursor=c2");

    expect(parseUrlState(membersSchema, params)).toEqual({
      search: "ana",
      role: "professor",
      sort: "createdAt",
      cursor: "c2",
    });
  });

  it("falls back to the declared default on an empty url", () => {
    expect(parseUrlState(membersSchema, new URLSearchParams())).toEqual(DEFAULTS);
  });

  it("keeps the valid parameters when one is invalid", () => {
    const params = new URLSearchParams("search=ana&role=hacker&sort=createdAt");

    expect(parseUrlState(membersSchema, params)).toEqual({
      search: "ana",
      role: "student",
      sort: "createdAt",
    });
  });

  it("ignores a parameter nobody declared", () => {
    const params = new URLSearchParams("search=ana&drop=table");

    expect(parseUrlState(membersSchema, params)).toEqual({ ...DEFAULTS, search: "ana" });
  });
});

describe("toSearchParams", () => {
  it("omits what equals the default, so a pristine url stays clean", () => {
    expect(toSearchParams(DEFAULTS, DEFAULTS).toString()).toBe("");
  });

  it("writes only what differs from the default", () => {
    const params = toSearchParams({ ...DEFAULTS, search: "ana", cursor: "c2" }, DEFAULTS);

    expect(params.get("search")).toBe("ana");
    expect(params.get("cursor")).toBe("c2");
    expect(params.has("role")).toBe(false);
  });

  it("drops an empty value instead of writing an empty parameter", () => {
    expect(toSearchParams({ search: "" }, {}).toString()).toBe("");
  });
});

describe("pagination reset", () => {
  it("recognises a change that is not pagination", () => {
    expect(touchesFilters({ search: "ana" })).toBe(true);
    expect(touchesFilters({ cursor: "c2", cursorStack: "c1" })).toBe(false);
  });

  it("strips the cursor and the stack", () => {
    expect(withoutPagination({ search: "ana", cursor: "c2", cursorStack: "c1" })).toEqual({
      search: "ana",
    });
  });
});
