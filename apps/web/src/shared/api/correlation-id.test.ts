import { describe, expect, it } from "vitest";
import { uuidV7 } from "./correlation-id";

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("uuidV7", () => {
  it("carries version 7 and the RFC 4122 variant", () => {
    expect(uuidV7()).toMatch(UUID_V7);
  });

  it("orders by time", () => {
    const earlier = uuidV7(1_700_000_000_000);
    const later = uuidV7(1_700_000_001_000);

    expect(earlier < later).toBe(true);
  });

  it("does not repeat within the same millisecond", () => {
    const values = new Set(Array.from({ length: 200 }, () => uuidV7(1_700_000_000_000)));

    expect(values.size).toBe(200);
  });
});
