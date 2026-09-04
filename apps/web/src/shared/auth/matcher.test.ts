import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MIDDLEWARE_MATCHER, runsMiddlewareOn } from "./matcher";

describe("middleware matcher", () => {
  it.each([
    "/_next/static/chunks/main.js",
    "/_next/image",
    "/favicon.ico",
    "/manifest.webmanifest",
    "/sw.js",
    "/icons/icon-192.png",
    "/fonts/inter.woff2",
    "/robots.txt",
  ])("does not spend a network call on %s", (asset) => {
    expect(runsMiddlewareOn(asset)).toBe(false);
  });

  it.each(["/", "/login", "/members", "/reports/wellbeing", "/accept-invitation/0198c4a1"])(
    "guards the page navigation %s",
    (route) => {
      expect(runsMiddlewareOn(route)).toBe(true);
    }
  );

  it("stays in step with the literal Next compiles", () => {
    const source = readFileSync(join(__dirname, "..", "..", "middleware.ts"), "utf8");
    const declared = source.match(/matcher:\s*\[\s*"(.+?)",?\s*\]/)?.[1];

    expect(declared).toBeDefined();
    expect(JSON.parse(`"${declared}"`)).toBe(MIDDLEWARE_MATCHER);
  });
});
