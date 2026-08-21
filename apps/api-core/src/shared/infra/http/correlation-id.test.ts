import { describe, expect, it } from "bun:test";
import { correlationIdOf, isCorrelationId } from "./correlation-id.ts";

const UUID_V4 = "9f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f";
const UUID_V7 = "0198c4a1-6f3e-7c21-9a44-1b2c3d4e5f60";

function requestWith(offered: string | null): Request {
  return new Request(
    "http://api.local/v1/members",
    offered === null ? undefined : { headers: { "X-Correlation-Id": offered } }
  );
}

describe("isCorrelationId", () => {
  it("accepts a UUID v4", () => {
    expect(isCorrelationId(UUID_V4)).toBe(true);
  });

  it("accepts a UUID v7", () => {
    expect(isCorrelationId(UUID_V7)).toBe(true);
  });

  it("rejects a UUID of another version", () => {
    expect(isCorrelationId("9f1c2d3e-4a5b-1c6d-8e9f-0a1b2c3d4e5f")).toBe(false);
  });

  it("rejects anything that is not a UUID", () => {
    expect(isCorrelationId("../../etc/passwd")).toBe(false);
    expect(isCorrelationId("")).toBe(false);
  });
});

describe("correlationIdOf", () => {
  it("keeps the value the client offered", () => {
    expect(correlationIdOf(requestWith(UUID_V7))).toBe(UUID_V7);
  });

  it("generates an acceptable one when the client offers none", () => {
    const generated = correlationIdOf(requestWith(null));

    expect(isCorrelationId(generated)).toBe(true);
  });

  it("generates an acceptable one when the client offers a malformed value", () => {
    const generated = correlationIdOf(requestWith("not-a-uuid"));

    expect(generated).not.toBe("not-a-uuid");
    expect(isCorrelationId(generated)).toBe(true);
  });

  it("answers the same value for the same request", () => {
    const request = requestWith(null);

    expect(correlationIdOf(request)).toBe(correlationIdOf(request));
  });

  it("answers a distinct value for a distinct request", () => {
    expect(correlationIdOf(requestWith(null))).not.toBe(correlationIdOf(requestWith(null)));
  });
});
