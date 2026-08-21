import Elysia from "elysia";
import { CORRELATION_ID_HEADER, correlationIdOf } from "./correlation-id.ts";
import { toErrorResponse } from "./error-response.ts";
import { requestIdentityOf } from "./request-identity.ts";
import { logRequest, toRequestLogEntry } from "./request-log.ts";

const DEFAULT_STATUS = 200;

const startedAt = new WeakMap<Request, number>();

function statusOf(status: string | number | undefined): number {
  return typeof status === "number" ? status : DEFAULT_STATUS;
}

function latencyOf(request: Request): number {
  const start = startedAt.get(request);
  return start === undefined ? 0 : Math.round(performance.now() - start);
}

export const httpPlugin = new Elysia({ name: "http" })
  .onRequest(({ request, set }) => {
    startedAt.set(request, performance.now());
    set.headers[CORRELATION_ID_HEADER] = correlationIdOf(request);
  })
  .onError({ as: "global" }, ({ code, error, request, set }) => {
    const failure = toErrorResponse(code, error, correlationIdOf(request));

    set.status = failure.status;
    for (const [name, value] of Object.entries(failure.headers)) {
      set.headers[name] = value;
    }

    return failure.body;
  })
  .onAfterResponse({ as: "global" }, ({ request, path, set }) => {
    logRequest(
      toRequestLogEntry({
        method: request.method,
        path,
        status: statusOf(set.status),
        latencyMs: latencyOf(request),
        correlationId: correlationIdOf(request),
        identity: requestIdentityOf(request),
      })
    );
  });
