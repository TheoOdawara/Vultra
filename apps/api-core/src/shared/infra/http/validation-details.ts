import { ValueErrorType } from "@sinclair/typebox/errors";

export type ValidationViolation = {
  readonly field: string;
  readonly rule: string;
  readonly message: string;
};

type TypeBoxViolation = {
  readonly type: number;
  readonly path: string;
  readonly message: string;
};

const UNKNOWN_RULE = "invalid";
const UNKNOWN_SCOPE = "request";

function isTypeBoxViolation(candidate: unknown): candidate is TypeBoxViolation {
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    "type" in candidate &&
    "path" in candidate &&
    "message" in candidate &&
    typeof candidate.type === "number" &&
    typeof candidate.path === "string" &&
    typeof candidate.message === "string"
  );
}

function ruleOf(violationType: number): string {
  const name = ValueErrorType[violationType];
  if (name === undefined) {
    return UNKNOWN_RULE;
  }
  return name.charAt(0).toLowerCase() + name.slice(1);
}

function fieldOf(path: string, scope: string): string {
  if (path.length === 0) {
    return scope;
  }
  return path.slice(1).replaceAll("/", ".");
}

function scopeOf(error: object): string {
  return "type" in error && typeof error.type === "string" ? error.type : UNKNOWN_SCOPE;
}

export function toValidationViolations(error: unknown): ValidationViolation[] {
  if (typeof error !== "object" || error === null || !("all" in error)) {
    return [];
  }

  const reported = error.all;
  if (!Array.isArray(reported)) {
    return [];
  }

  const scope = scopeOf(error);

  return reported.filter(isTypeBoxViolation).map((violation) => ({
    field: fieldOf(violation.path, scope),
    rule: ruleOf(violation.type),
    message: violation.message,
  }));
}
