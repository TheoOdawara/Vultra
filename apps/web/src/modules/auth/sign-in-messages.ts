import { UNKNOWN_ERROR_MESSAGE } from "@/shared/api/errors";

export const INVALID_CREDENTIALS_MESSAGE = "E-mail ou senha incorretos.";

export const DISABLED_ACCOUNT_MESSAGE =
  "Esta conta está desativada. Procure o gestor da instituição.";

export const DEFAULT_RETRY_AFTER_SECONDS = 60;

const INVALID_CREDENTIAL_CODES: readonly string[] = [
  "INVALID_EMAIL",
  "INVALID_EMAIL_OR_PASSWORD",
  "USER_NOT_FOUND",
  "USER_EMAIL_NOT_FOUND",
  "CREDENTIAL_ACCOUNT_NOT_FOUND",
];

const DISABLED_ACCOUNT_CODES: readonly string[] = ["BANNED_USER", "ACCOUNT_DISABLED"];

export interface SignInFailure {
  status: number;
  code?: string;
  retryAfterSeconds?: number;
}

export function rateLimitMessage(seconds: number): string {
  return `Muitas tentativas. Tente novamente em ${seconds} segundos.`;
}

export function messageForSignInFailure(failure: SignInFailure): string {
  if (failure.status === 429) {
    return rateLimitMessage(failure.retryAfterSeconds ?? DEFAULT_RETRY_AFTER_SECONDS);
  }

  const code = failure.code ?? "";

  if (DISABLED_ACCOUNT_CODES.includes(code)) return DISABLED_ACCOUNT_MESSAGE;
  if (INVALID_CREDENTIAL_CODES.includes(code)) return INVALID_CREDENTIALS_MESSAGE;
  if (failure.status === 401 || failure.status === 403) return INVALID_CREDENTIALS_MESSAGE;

  return UNKNOWN_ERROR_MESSAGE;
}
