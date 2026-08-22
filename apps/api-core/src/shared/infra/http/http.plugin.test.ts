import { afterEach, beforeEach, describe, expect, it, type Mock, spyOn } from "bun:test";
import Elysia, { t } from "elysia";
import {
  RateLimitExceededError,
  SessionNotFoundError,
} from "../../../core/domain/errors/DomainError.ts";
import { httpPlugin } from "./http.plugin.ts";

const OFFERED_CORRELATION_ID = "0198c4a1-6f3e-7c21-9a44-1b2c3d4e5f60";
const FRAME_BASE64 = "R0lGODlhAQABAIAAAAAAAP-THE-BIOMETRIC-FRAME-ITSELF";
const INTERNAL_FAILURE =
  "connect ECONNREFUSED postgres://vultra:hunter2@db-primary.internal:5432/vultra — SELECT * FROM biometric_profiles";

type ErrorBody = {
  error: {
    code: string;
    message: string;
    correlationId: string;
    details?: { field: string; rule: string; message: string }[];
  };
};

function buildApp() {
  return new Elysia()
    .use(httpPlugin)
    .post("/v1/biometric-profiles", () => ({ ok: true }), {
      body: t.Object({
        memberId: t.String({ format: "uuid" }),
        frameBase64: t.String({ minLength: 1 }),
        limit: t.Number({ maximum: 100 }),
      }),
    })
    .get("/v1/sessions/absent", () => {
      throw new SessionNotFoundError();
    })
    .get("/v1/throttled", () => {
      throw new RateLimitExceededError(60);
    })
    .get("/v1/broken", () => {
      throw new Error(INTERNAL_FAILURE);
    })
    .get("/v1/health", () => ({ status: "ok" }));
}

function malformedBiometricRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://api.local/v1/biometric-profiles", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ memberId: "not-a-uuid", frameBase64: FRAME_BASE64, limit: 500 }),
  });
}

let app: ReturnType<typeof buildApp>;
let logged: Mock<typeof console.log>;

beforeEach(() => {
  app = buildApp();
  logged = spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
  logged.mockRestore();
});

async function loggedLines(): Promise<string[]> {
  await Bun.sleep(0);
  return logged.mock.calls.map((call) => String(call[0]));
}

describe("scenario 13 — an error carries the correlation id", () => {
  it("echoes the offered id in the header, in the body and in the log line", async () => {
    const response = await app.handle(
      malformedBiometricRequest({ "X-Correlation-Id": OFFERED_CORRELATION_ID })
    );
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(422);
    expect(response.headers.get("X-Correlation-Id")).toBe(OFFERED_CORRELATION_ID);
    expect(body.error.correlationId).toBe(OFFERED_CORRELATION_ID);
    expect(await loggedLines()).toContainEqual(expect.stringContaining(OFFERED_CORRELATION_ID));
  });

  it("carries one generated id through header, body and log when none is offered", async () => {
    const response = await app.handle(malformedBiometricRequest());
    const body = (await response.json()) as ErrorBody;
    const echoed = response.headers.get("X-Correlation-Id");

    expect(echoed).toBe(body.error.correlationId);
    expect(await loggedLines()).toContainEqual(expect.stringContaining(body.error.correlationId));
  });

  it("echoes the correlation id on a successful response too", async () => {
    const response = await app.handle(
      new Request("http://api.local/v1/health", {
        headers: { "X-Correlation-Id": OFFERED_CORRELATION_ID },
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Correlation-Id")).toBe(OFFERED_CORRELATION_ID);
  });

  it("logs route, method, status and latency alongside the correlation id", async () => {
    await app.handle(
      new Request("http://api.local/v1/health", {
        headers: { "X-Correlation-Id": OFFERED_CORRELATION_ID },
      })
    );
    const [line] = await loggedLines();
    const entry = JSON.parse(String(line)) as Record<string, unknown>;

    expect(entry.method).toBe("GET");
    expect(entry.path).toBe("/v1/health");
    expect(entry.status).toBe(200);
    expect(entry.correlationId).toBe(OFFERED_CORRELATION_ID);
    expect(typeof entry.latencyMs).toBe("number");
  });
});

describe("scenario 14 — an error never echoes the request", () => {
  it("keeps the biometric frame out of the response", async () => {
    const response = await app.handle(malformedBiometricRequest());

    expect(await response.text()).not.toContain(FRAME_BASE64);
  });

  it("keeps the biometric frame out of the log", async () => {
    await app.handle(malformedBiometricRequest());

    for (const line of await loggedLines()) {
      expect(line).not.toContain(FRAME_BASE64);
    }
  });

  it("keeps SQL, host and credentials out of an internal failure", async () => {
    const response = await app.handle(new Request("http://api.local/v1/broken"));
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(text).not.toContain("db-primary.internal");
    expect(text).not.toContain("hunter2");
    expect(text).not.toContain("SELECT");
    expect(text).not.toContain("biometric_profiles");
    expect((JSON.parse(text) as ErrorBody).error.code).toBe("INTERNAL_SERVER_ERROR");
  });
});

describe("scenario 16 — every validation violation comes at once", () => {
  it("reports the three broken fields, each naming its field and its rule", async () => {
    const response = await app.handle(
      new Request("http://api.local/v1/biometric-profiles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberId: "not-a-uuid", frameBase64: "", limit: 500 }),
      })
    );
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(422);
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(body.error.details).toHaveLength(3);
    expect(body.error.details?.map((violation) => violation.field).sort()).toEqual([
      "frameBase64",
      "limit",
      "memberId",
    ]);
    for (const violation of body.error.details ?? []) {
      expect(violation.rule.length).toBeGreaterThan(0);
      expect(violation.message.length).toBeGreaterThan(0);
    }
  });

  it("names the rule that each field broke", () => {
    return app
      .handle(
        new Request("http://api.local/v1/biometric-profiles", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ memberId: "not-a-uuid", frameBase64: "", limit: 500 }),
        })
      )
      .then((response) => response.json() as Promise<ErrorBody>)
      .then((body) => {
        const rules = Object.fromEntries(
          (body.error.details ?? []).map((violation) => [violation.field, violation.rule])
        );

        expect(rules.memberId).toBe("stringFormat");
        expect(rules.frameBase64).toBe("stringMinLength");
        expect(rules.limit).toBe("numberMaximum");
      });
  });
});

describe("domain errors keep their contract", () => {
  it("maps a domain error to its own code and status", async () => {
    const response = await app.handle(new Request("http://api.local/v1/sessions/absent"));
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("SESSION_NOT_FOUND");
    expect(body.error.message).toBe("Attendance session not found");
    expect(body.error.details).toBeUndefined();
  });

  it("keeps Retry-After on a throttled response", async () => {
    const response = await app.handle(new Request("http://api.local/v1/throttled"));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(((await response.json()) as ErrorBody).error.code).toBe("RATE_LIMIT_EXCEEDED");
  });

  it("answers an unmatched route with the same error shape", async () => {
    const response = await app.handle(new Request("http://api.local/v1/nowhere"));
    const body = (await response.json()) as ErrorBody;

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.correlationId.length).toBeGreaterThan(0);
  });
});
