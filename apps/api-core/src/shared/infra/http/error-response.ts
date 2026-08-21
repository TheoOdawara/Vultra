import type { DomainError } from "../../../core/domain/errors/DomainError.ts";
import { CORRELATION_ID_HEADER } from "./correlation-id.ts";
import { toValidationViolations, type ValidationViolation } from "./validation-details.ts";

export type ErrorBody = {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly correlationId: string;
    readonly details?: readonly ValidationViolation[];
  };
};

export type ErrorResponse = {
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly body: ErrorBody;
};

type RetryableDomainError = DomainError & { readonly retryAfter?: number };

const VALIDATION_STATUS = 422;
const MALFORMED_BODY_STATUS = 400;
const NOT_FOUND_STATUS = 404;
const INTERNAL_STATUS = 500;

function isDomainError(error: unknown): error is RetryableDomainError {
  return (
    typeof error === "object" &&
    error !== null &&
    "errorCode" in error &&
    "httpStatus" in error &&
    typeof error.errorCode === "string" &&
    typeof error.httpStatus === "number" &&
    "message" in error &&
    typeof error.message === "string"
  );
}

function retryAfterHeaders(error: RetryableDomainError): Record<string, string> {
  return typeof error.retryAfter === "number" ? { "Retry-After": String(error.retryAfter) } : {};
}

export function toErrorResponse(
  code: string | number,
  error: unknown,
  correlationId: string
): ErrorResponse {
  const correlationHeader = { [CORRELATION_ID_HEADER]: correlationId };

  if (isDomainError(error)) {
    return {
      status: error.httpStatus,
      headers: { ...correlationHeader, ...retryAfterHeaders(error) },
      body: { error: { code: error.errorCode, message: error.message, correlationId } },
    };
  }

  if (code === "VALIDATION") {
    return {
      status: VALIDATION_STATUS,
      headers: correlationHeader,
      body: {
        error: {
          code: "VALIDATION_FAILED",
          message: "Request validation failed",
          correlationId,
          details: toValidationViolations(error),
        },
      },
    };
  }

  if (code === "PARSE") {
    return {
      status: MALFORMED_BODY_STATUS,
      headers: correlationHeader,
      body: {
        error: {
          code: "MALFORMED_BODY",
          message: "Request body could not be parsed",
          correlationId,
        },
      },
    };
  }

  if (code === "NOT_FOUND") {
    return {
      status: NOT_FOUND_STATUS,
      headers: correlationHeader,
      body: { error: { code: "NOT_FOUND", message: "Resource not found", correlationId } },
    };
  }

  return {
    status: INTERNAL_STATUS,
    headers: correlationHeader,
    body: {
      error: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error", correlationId },
    },
  };
}
