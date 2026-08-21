import type { RequestIdentity } from "./request-identity.ts";

export type RequestLogEntry = {
  readonly method: string;
  readonly path: string;
  readonly status: number;
  readonly latencyMs: number;
  readonly correlationId: string;
  readonly userId: string | null;
  readonly organizationId: string | null;
  readonly role: string | null;
};

export function toRequestLogEntry(input: {
  readonly method: string;
  readonly path: string;
  readonly status: number;
  readonly latencyMs: number;
  readonly correlationId: string;
  readonly identity: RequestIdentity | null;
}): RequestLogEntry {
  return {
    method: input.method,
    path: input.path,
    status: input.status,
    latencyMs: input.latencyMs,
    correlationId: input.correlationId,
    userId: input.identity?.userId ?? null,
    organizationId: input.identity?.organizationId ?? null,
    role: input.identity?.role ?? null,
  };
}

export function logRequest(entry: RequestLogEntry): void {
  console.log(JSON.stringify(entry));
}
