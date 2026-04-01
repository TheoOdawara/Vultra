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
import { DomainError } from "../core/domain/errors/DomainError";

export const globalErrorHandler = new Elysia({ name: "global-error-handler" }).onError(
  ({ code, error, set }) => {
    // ── 1. Domain errors ──────────────────────────────────────────────────
    if (error instanceof DomainError) {
      set.status = error.httpStatus;
      return {
        error: error.errorCode,
        message: error.message,
      };
    }

    // ── 2. TypeBox / Elysia validation errors ────────────────────────────
    if (code === "VALIDATION") {
      set.status = 400;
      return {
        error: "VALIDATION_ERROR",
        message: error.message,
      };
    }

    // ── 3. Not found (unmatched route) ───────────────────────────────────
    if (code === "NOT_FOUND") {
      set.status = 404;
      return { error: "NOT_FOUND" };
    }

    // ── 4. Unknown / internal ─────────────────────────────────────────────
    // Log server-side but never expose stack in response
    console.error("[ERROR]", error);
    set.status = 500;
    return { error: "INTERNAL_SERVER_ERROR" };
  },
);
