import type { ApiErrorBody, ApiErrorCode, ApiErrorDetail } from "@vultra/types";
import { env } from "@/shared/env/env";
import { uuidV7 } from "./correlation-id";
import { ApiError } from "./errors";

export type QueryValue = string | number | boolean | undefined;

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  query?: Record<string, QueryValue>;
  body?: unknown;
  ifMatch?: string;
  ifNoneMatch?: string;
  signal?: AbortSignal;
}

export type ApiResponse<T> =
  | { notModified: false; data: T; etag: string | null; correlationId: string; status: number }
  | { notModified: true; etag: string | null; correlationId: string; status: 304 };

function buildUrl(path: string, query: Record<string, QueryValue> | undefined): string {
  const url = new URL(`${env.NEXT_PUBLIC_API_URL}${path}`);

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined) continue;
    url.searchParams.set(key, String(value));
  }

  return url.toString();
}

function retryAfterOf(response: Response): number | undefined {
  const header = response.headers.get("Retry-After");
  if (header === null) return undefined;

  const seconds = Number.parseInt(header, 10);
  return Number.isNaN(seconds) ? undefined : seconds;
}

async function failureOf(response: Response, correlationId: string): Promise<ApiError> {
  let code: ApiErrorCode = "INTERNAL_SERVER_ERROR";
  let serverMessage = "";
  let details: ApiErrorDetail[] | undefined;
  let id = correlationId;

  try {
    const body = (await response.json()) as ApiErrorBody;
    if (typeof body?.error?.code === "string") {
      code = body.error.code;
      serverMessage = body.error.message;
      details = body.error.details;
      if (typeof body.error.correlationId === "string") id = body.error.correlationId;
    }
  } catch {
    // O corpo pode nao ser JSON quando a falha vem de um proxy antes da API.
  }

  return new ApiError({
    status: response.status,
    code,
    correlationId: id,
    serverMessage,
    details,
    retryAfterSeconds: retryAfterOf(response),
  });
}

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const correlationId = uuidV7();
  const headers = new Headers({ "X-Correlation-Id": correlationId });

  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (options.ifMatch !== undefined) headers.set("If-Match", options.ifMatch);
  if (options.ifNoneMatch !== undefined) headers.set("If-None-Match", options.ifNoneMatch);

  let response: Response;

  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? "GET",
      credentials: "include",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;

    throw new ApiError({
      status: 0,
      code: "NETWORK_ERROR",
      correlationId,
      serverMessage: "",
    });
  }

  const echoed = response.headers.get("X-Correlation-Id") ?? correlationId;
  const etag = response.headers.get("ETag");

  if (response.status === 304) {
    return { notModified: true, etag, correlationId: echoed, status: 304 };
  }

  if (!response.ok) throw await failureOf(response, echoed);

  const data = response.status === 204 ? (undefined as T) : ((await response.json()) as T);

  return { notModified: false, data, etag, correlationId: echoed, status: response.status };
}
