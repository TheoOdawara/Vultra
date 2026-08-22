import { describe, expect, it } from "bun:test";
import { readEnvironment } from "./environment.ts";

const VALID_SOURCE: Record<string, string> = {
  DATABASE_URL: "postgresql://vultra:secret@postgres:5432/vultra_db",
  REDIS_URL: "redis://:secret@redis:6379",
  BETTER_AUTH_SECRET: "0123456789012345678901234567890123456789",
  BETTER_AUTH_URL: "http://localhost:3000",
  BETTER_AUTH_TRUSTED_ORIGINS: "https://admin.vultra.app, https://rh.vultra.app",
  PORT: "3000",
  AI_QUEUE_NAME: "ai:recognition:queue",
  AI_RESULT_PREFIX: "ai:recognition:result:",
};

function sourceWithout(name: string): Record<string, string> {
  const source = { ...VALID_SOURCE };
  delete source[name];
  return source;
}

function sourceWith(name: string, value: string): Record<string, string> {
  return { ...VALID_SOURCE, [name]: value };
}

describe("readEnvironment", () => {
  it("parses a complete environment into typed values", () => {
    const environment = readEnvironment(VALID_SOURCE);

    expect(environment.databaseUrl).toBe(VALID_SOURCE.DATABASE_URL as string);
    expect(environment.redisUrl).toBe(VALID_SOURCE.REDIS_URL as string);
    expect(environment.authSecret).toBe(VALID_SOURCE.BETTER_AUTH_SECRET as string);
    expect(environment.authBaseUrl).toBe(VALID_SOURCE.BETTER_AUTH_URL as string);
    expect(environment.trustedOrigins).toEqual([
      "https://admin.vultra.app",
      "https://rh.vultra.app",
    ]);
    expect(environment.port).toBe(3000);
    expect(environment.aiQueueName).toBe(VALID_SOURCE.AI_QUEUE_NAME as string);
    expect(environment.aiResultPrefix).toBe(VALID_SOURCE.AI_RESULT_PREFIX as string);
  });

  it.each(Object.keys(VALID_SOURCE))("fails naming %s and its expected format", (name) => {
    expect(() => readEnvironment(sourceWithout(name))).toThrow(new RegExp(`${name}: expected `));
  });

  it("reports every missing variable in a single failure", () => {
    expect(() => readEnvironment({})).toThrow(/DATABASE_URL[\s\S]*AI_RESULT_PREFIX/);
  });

  it.each([
    ["DATABASE_URL", "mysql://vultra:secret@postgres:3306/vultra_db"],
    ["REDIS_URL", "http://redis:6379"],
    ["BETTER_AUTH_SECRET", "too-short"],
    ["BETTER_AUTH_URL", "localhost:3000"],
    ["BETTER_AUTH_TRUSTED_ORIGINS", "admin.vultra.app"],
    ["PORT", "0"],
    ["PORT", "not-a-number"],
    ["PORT", "65536"],
    ["AI_QUEUE_NAME", "   "],
    ["AI_RESULT_PREFIX", ""],
  ])("rejects %s with value %p", (name, value) => {
    expect(() => readEnvironment(sourceWith(name, value))).toThrow(
      new RegExp(`${name}: expected `)
    );
  });

  it("rejects a trusted origin list whose entries are not all valid", () => {
    expect(() =>
      readEnvironment(sourceWith("BETTER_AUTH_TRUSTED_ORIGINS", "https://admin.vultra.app,not-a-url"))
    ).toThrow(/BETTER_AUTH_TRUSTED_ORIGINS: expected /);
  });

  it("never falls back to a default when a variable is absent", () => {
    for (const name of Object.keys(VALID_SOURCE)) {
      expect(() => readEnvironment(sourceWithout(name))).toThrow();
    }
  });
});
