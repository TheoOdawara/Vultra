import { describe, expect, it } from "vitest";
import { UNKNOWN_ERROR_MESSAGE } from "@/shared/api/errors";
import {
  DEFAULT_RETRY_AFTER_SECONDS,
  DISABLED_ACCOUNT_MESSAGE,
  INVALID_CREDENTIALS_MESSAGE,
  messageForSignInFailure,
} from "./sign-in-messages";

describe("messageForSignInFailure", () => {
  it.each([
    "INVALID_EMAIL",
    "INVALID_EMAIL_OR_PASSWORD",
    "USER_NOT_FOUND",
    "USER_EMAIL_NOT_FOUND",
    "CREDENTIAL_ACCOUNT_NOT_FOUND",
  ])("says nothing about which half is wrong for %s", (code) => {
    expect(messageForSignInFailure({ status: 401, code })).toBe(INVALID_CREDENTIALS_MESSAGE);
  });

  it.each(["BANNED_USER", "ACCOUNT_DISABLED"])(
    "points a disabled account at the manager",
    (code) => {
      expect(messageForSignInFailure({ status: 403, code })).toBe(DISABLED_ACCOUNT_MESSAGE);
    }
  );

  it("counts the seconds the API asked for on 429", () => {
    expect(messageForSignInFailure({ status: 429, retryAfterSeconds: 42 })).toBe(
      "Muitas tentativas. Tente novamente em 42 segundos."
    );
  });

  it("falls back to a declared wait when 429 carries no Retry-After", () => {
    expect(messageForSignInFailure({ status: 429 })).toBe(
      `Muitas tentativas. Tente novamente em ${DEFAULT_RETRY_AFTER_SECONDS} segundos.`
    );
  });

  it("treats an unlabelled 401 as an invalid credential", () => {
    expect(messageForSignInFailure({ status: 401 })).toBe(INVALID_CREDENTIALS_MESSAGE);
  });

  it("never shows the English prose of an unknown failure", () => {
    expect(messageForSignInFailure({ status: 500, code: "SOMETHING_ELSE" })).toBe(
      UNKNOWN_ERROR_MESSAGE
    );
    expect(messageForSignInFailure({ status: 0 })).toBe(UNKNOWN_ERROR_MESSAGE);
  });
});
