import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/msw";
import { ApiError, messageForError } from "./errors";
import { apiRequest } from "./http";

const API = "https://api.vultra.test";
const CORRELATION_ID = "0198c4a1-6f3e-7c21-9a44-1b2c3d4e5f60";

function errorBody(code: string, message: string) {
  return { error: { code, message, correlationId: CORRELATION_ID } };
}

describe("apiRequest", () => {
  it("calls the configured base url with credentials and a v7 correlation id", async () => {
    let seen: Request | undefined;
    server.use(
      http.get(`${API}/v1/members`, ({ request }) => {
        seen = request;
        return HttpResponse.json({ items: [], page: { nextCursor: null, limit: 50 } });
      })
    );

    await apiRequest("/v1/members");

    expect(seen?.credentials).toBe("include");
    const sent = seen?.headers.get("X-Correlation-Id");
    expect(sent).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("returns the parsed collection envelope", async () => {
    server.use(
      http.get(`${API}/v1/members`, () =>
        HttpResponse.json({ items: [{ id: "m1" }], page: { nextCursor: "c2", limit: 50 } })
      )
    );

    const response = await apiRequest<{ items: { id: string }[] }>("/v1/members");

    expect(response.notModified).toBe(false);
    if (response.notModified) throw new Error("unreachable");
    expect(response.data.items).toEqual([{ id: "m1" }]);
  });

  it("serializes only the query entries that carry a value", async () => {
    let url: string | undefined;
    server.use(
      http.get(`${API}/v1/members`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({ items: [], page: { nextCursor: null, limit: 50 } });
      })
    );

    await apiRequest("/v1/members", {
      query: { cursor: "abc", limit: 50, search: undefined, isActive: true },
    });

    const query = new URL(url ?? "").searchParams;
    expect(query.get("cursor")).toBe("abc");
    expect(query.get("limit")).toBe("50");
    expect(query.get("isActive")).toBe("true");
    expect(query.has("search")).toBe(false);
  });

  it("echoes back the correlation id the server answered with", async () => {
    const serverSide = "0198dddd-6f3e-7c21-9a44-1b2c3d4e5f60";
    server.use(
      http.get(`${API}/v1/health`, () =>
        HttpResponse.json({ status: "ok" }, { headers: { "X-Correlation-Id": serverSide } })
      )
    );

    const response = await apiRequest("/v1/health");

    expect(response.correlationId).toBe(serverSide);
  });

  it("throws ApiError carrying status, code and correlation id", async () => {
    server.use(
      http.get(`${API}/v1/members`, () =>
        HttpResponse.json(errorBody("INSUFFICIENT_PERMISSIONS", "Insufficient permissions"), {
          status: 403,
        })
      )
    );

    const error = await apiRequest("/v1/members").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.status).toBe(403);
    expect(apiError.code).toBe("INSUFFICIENT_PERMISSIONS");
    expect(apiError.correlationId).toBe(CORRELATION_ID);
  });

  it("carries the validation details of a 422", async () => {
    server.use(
      http.get(`${API}/v1/members`, () =>
        HttpResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Request validation failed",
              correlationId: CORRELATION_ID,
              details: [{ field: "limit", rule: "maximum", message: "limit must be at most 100" }],
            },
          },
          { status: 422 }
        )
      )
    );

    const error = (await apiRequest("/v1/members").catch((e: unknown) => e)) as ApiError;

    expect(error.details).toEqual([
      { field: "limit", rule: "maximum", message: "limit must be at most 100" },
    ]);
  });

  it("reads Retry-After on a 429", async () => {
    server.use(
      http.post(`${API}/v1/members`, () =>
        HttpResponse.json(errorBody("RATE_LIMIT_EXCEEDED", "Too many requests"), {
          status: 429,
          headers: { "Retry-After": "30" },
        })
      )
    );

    const error = (await apiRequest("/v1/members", {
      method: "POST",
      body: { fullName: "Ana" },
    }).catch((e: unknown) => e)) as ApiError;

    expect(error.retryAfterSeconds).toBe(30);
  });

  it("treats 304 as no news instead of failure", async () => {
    server.use(
      http.get(`${API}/v1/attendance/sessions/s1/records`, () =>
        HttpResponse.text(null, { status: 304, headers: { ETag: 'W/"7"' } })
      )
    );

    const response = await apiRequest("/v1/attendance/sessions/s1/records", {
      ifNoneMatch: 'W/"7"',
    });

    expect(response.notModified).toBe(true);
    expect(response.etag).toBe('W/"7"');
  });

  it("sends If-Match and If-None-Match when given", async () => {
    let seen: Request | undefined;
    server.use(
      http.patch(`${API}/v1/attendance/sessions/s1`, ({ request }) => {
        seen = request;
        return HttpResponse.json({ id: "s1", status: "closed" });
      })
    );

    await apiRequest("/v1/attendance/sessions/s1", {
      method: "PATCH",
      body: { status: "closed" },
      ifMatch: 'W/"7"',
    });

    expect(seen?.headers.get("If-Match")).toBe('W/"7"');
    expect(seen?.headers.get("Content-Type")).toBe("application/json");
  });

  it("exposes the ETag of a readable resource", async () => {
    server.use(
      http.get(`${API}/v1/attendance/sessions/s1`, () =>
        HttpResponse.json({ id: "s1" }, { headers: { ETag: 'W/"9"' } })
      )
    );

    const response = await apiRequest("/v1/attendance/sessions/s1");

    expect(response.etag).toBe('W/"9"');
  });

  it("survives an error body that is not the documented shape", async () => {
    server.use(
      http.get(`${API}/v1/members`, () =>
        HttpResponse.text("<html>502</html>", {
          status: 502,
          headers: { "X-Correlation-Id": CORRELATION_ID },
        })
      )
    );

    const error = (await apiRequest("/v1/members").catch((e: unknown) => e)) as ApiError;

    expect(error.status).toBe(502);
    expect(error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(error.correlationId).toBe(CORRELATION_ID);
    expect(messageForError(error)).toBe("Não foi possível concluir a operação. Tente novamente.");
  });

  it("turns a transport failure into an ApiError instead of leaking it", async () => {
    server.use(http.get(`${API}/v1/members`, () => HttpResponse.error()));

    const error = (await apiRequest("/v1/members").catch((e: unknown) => e)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe("NETWORK_ERROR");
    expect(error.status).toBe(0);
  });

  it("never sends an offset parameter", async () => {
    let url: string | undefined;
    server.use(
      http.get(`${API}/v1/members`, ({ request }) => {
        url = request.url;
        return HttpResponse.json({ items: [], page: { nextCursor: null, limit: 50 } });
      })
    );

    await apiRequest("/v1/members", { query: { cursor: "abc", limit: 50 } });

    expect(new URL(url ?? "").searchParams.has("offset")).toBe(false);
  });
});
