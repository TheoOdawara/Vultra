import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { API_ERROR_CODES, isKnownApiErrorCode } from "@vultra/types";
import { describe, expect, it } from "vitest";

const TYPES_SRC = join(process.cwd(), "..", "..", "packages", "types", "src");

function readAllSources(dir: string): { file: string; source: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return readAllSources(path);
    if (!entry.name.endsWith(".ts")) return [];
    return [{ file: path, source: readFileSync(path, "utf8") }];
  });
}

describe("packages/types against SPEC-002", () => {
  const sources = readAllSources(TYPES_SRC);

  it("has sources to inspect", () => {
    expect(sources.length).toBeGreaterThan(0);
  });

  it("declares no collection field named total", () => {
    const offenders = sources.filter(({ source }) => /^\s*total\??:/m.test(source));
    expect(offenders.map(({ file }) => file)).toEqual([]);
  });

  it("declares no offset pagination", () => {
    const offenders = sources.filter(({ source }) => /^\s*offset\??:/m.test(source));
    expect(offenders.map(({ file }) => file)).toEqual([]);
  });

  it("references no legacy biometric path", () => {
    const offenders = sources.filter(
      ({ source }) => source.includes("/v1/face/") || source.includes("/v1/biometric/")
    );
    expect(offenders.map(({ file }) => file)).toEqual([]);
  });

  it("carries no accented enum literal", () => {
    const offenders = sources.filter(({ source }) => /[À-ÿ]/.test(source));
    expect(offenders.map(({ file }) => file)).toEqual([]);
  });

  it("enumerates every error code of the spec table", () => {
    expect(API_ERROR_CODES).toHaveLength(25);
    expect(isKnownApiErrorCode("INSUFFICIENT_PERMISSIONS")).toBe(true);
    expect(isKnownApiErrorCode("FORBIDDEN")).toBe(false);
  });
});
