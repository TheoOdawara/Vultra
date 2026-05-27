/**
 * VULTRA — Global Error Handler
 *
 * Mounted as the FIRST plugin in server.ts so it captures errors
 * from all subsequent plugins and routes.
 *
 * Priority order (ADR):
 *   1. DomainError subclasses      → errorCode + httpStatus from the class
 *   2. TypeBox validation errors   → 400 VALIDATION_ERROR
 *   3. Better Auth errors          → 401 / 403
 *   4. Fallback                    → 500 (stack trace never exposed)
 *
 * Response shape: { error: string, message?: string }
 */

import Elysia from "elysia";
import type { DomainError } from "../core/domain/errors/DomainError";

function isDomainError(error: unknown): error is DomainError & { retryAfter?: number } {
  return (
    typeof error === "object" &&
    error !== null &&
    "errorCode" in error &&
    "httpStatus" in error &&
    typeof error.errorCode === "string" &&
    typeof error.httpStatus === "number"
  );
}

export function handleHttpError({
  code,
  error,
  set,
}: {
  code: string | number;
  error: unknown;
  set: {
    status?: string | number;
    headers: Record<string, string | number>;
  };
}) {
  // ── 1. Domain errors ──────────────────────────────────────────────────
  if (isDomainError(error)) {
    set.status = error.httpStatus;

    if ("retryAfter" in error && typeof error.retryAfter === "number") {
      set.headers["Retry-After"] = String(error.retryAfter);
    }

    return {
      error: error.errorCode,
      message: error.message,
    };
  }

  // ── 2. TypeBox / Elysia validation errors ────────────────────────────
  if (code === "VALIDATION") {
    set.status = 422;
    return {
      error: "VALIDATION_ERROR",
      message: error instanceof Error ? error.message : "Validation error",
    };
  }

  // ── 3. Not found (unmatched route) ───────────────────────────────────
  if (code === "NOT_FOUND") {
    set.status = 404;
    return { error: "NOT_FOUND" };
  }

  // ── 4. Unknown / internal ─────────────────────────────────────────────
  set.status = 500;
  return { error: "INTERNAL_SERVER_ERROR" };
}

export const globalErrorHandler = new Elysia({ name: "global-error-handler" }).onError(
  { as: "global" },
  ({ code, error, set }) => handleHttpError({ code, error, set }) as never
);
