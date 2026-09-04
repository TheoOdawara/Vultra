import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const VARIABLES = ["NEXT_PUBLIC_API_URL", "NEXT_PUBLIC_APP_URL"] as const;

async function loadEnv() {
  const module = await import("./env.js");
  return module.readEnv;
}

describe("env module", () => {
  let readEnv: Awaited<ReturnType<typeof loadEnv>>;
  const original: Record<string, string | undefined> = {};

  beforeEach(async () => {
    for (const name of VARIABLES) original[name] = process.env[name];
    readEnv = await loadEnv();
  });

  afterEach(() => {
    for (const name of VARIABLES) {
      const value = original[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it("reads both absolute urls from the source", () => {
    const env = readEnv({
      NEXT_PUBLIC_API_URL: "https://api.vultra.test",
      NEXT_PUBLIC_APP_URL: "https://portal.vultra.test",
    });

    expect(env).toEqual({
      NEXT_PUBLIC_API_URL: "https://api.vultra.test",
      NEXT_PUBLIC_APP_URL: "https://portal.vultra.test",
    });
  });

  it.each(VARIABLES)("fails naming %s when it is missing", (name) => {
    const source: Record<string, string> = {
      NEXT_PUBLIC_API_URL: "https://api.vultra.test",
      NEXT_PUBLIC_APP_URL: "https://portal.vultra.test",
    };
    delete source[name];

    expect(() => readEnv(source)).toThrowError(new RegExp(name));
  });

  it("fails naming the variable when it is empty", () => {
    expect(() =>
      readEnv({ NEXT_PUBLIC_API_URL: "", NEXT_PUBLIC_APP_URL: "https://portal.vultra.test" })
    ).toThrowError(/NEXT_PUBLIC_API_URL/);
  });

  it("rejects a relative url and says the expected format", () => {
    expect(() =>
      readEnv({ NEXT_PUBLIC_API_URL: "/api", NEXT_PUBLIC_APP_URL: "https://portal.vultra.test" })
    ).toThrowError(/absolute url/i);
  });

  it("rejects a trailing slash", () => {
    expect(() =>
      readEnv({
        NEXT_PUBLIC_API_URL: "https://api.vultra.test/",
        NEXT_PUBLIC_APP_URL: "https://portal.vultra.test",
      })
    ).toThrowError(/trailing slash/i);
  });

  it("reports every missing variable at once", () => {
    expect(() => readEnv({})).toThrowError(/NEXT_PUBLIC_API_URL[\s\S]*NEXT_PUBLIC_APP_URL/);
  });

  it("never falls back to a default when the source is empty", () => {
    let thrown: unknown;
    try {
      readEnv({});
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect(String(thrown)).not.toMatch(/localhost/);
  });

  it("gives no default at the point of reading the environment", () => {
    const source = readFileSync(join(__dirname, "env.ts"), "utf8");
    const reads = source.match(/process\.env\.[A-Z_]+[^\r\n]*/g) ?? [];

    expect(reads.length).toBeGreaterThan(0);
    for (const read of reads) {
      expect(read).not.toMatch(/\?\?|\|\|/);
    }
  });

  it("reads only the two declared variables", () => {
    const source = readFileSync(join(__dirname, "env.ts"), "utf8");
    const names = [...source.matchAll(/process\.env\.([A-Z_]+)/g)].map((match) => match[1]);

    expect(new Set(names)).toEqual(new Set(VARIABLES));
  });
});
