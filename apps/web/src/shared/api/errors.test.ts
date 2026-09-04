import { describe, expect, it } from "vitest";
import { ApiError, messageForError, UNKNOWN_ERROR_MESSAGE } from "./errors";

function apiError(code: string, extra: { retryAfterSeconds?: number } = {}) {
  return new ApiError({
    status: 400,
    code,
    correlationId: "0198c4a1-6f3e-7c21-9a44-1b2c3d4e5f60",
    serverMessage: "Insufficient permissions",
    ...extra,
  });
}

describe("messageForError", () => {
  it.each([
    ["INSUFFICIENT_PERMISSIONS", "Você não tem permissão para esta ação."],
    ["INVALID_CURSOR", "A navegação expirou. Voltando para a primeira página."],
    ["MEMBER_EXTERNAL_CODE_CONFLICT", "Este código externo já está em uso por outro membro ativo."],
    [
      "LIVENESS_CHECK_FAILED",
      "A captura não corresponde a uma pessoa presente. Capture novamente, ao vivo.",
    ],
    ["SESSION_ALREADY_CLOSED", "Esta sessão de chamada já foi encerrada."],
    ["PRECONDITION_FAILED", "A sessão mudou em outro dispositivo. Recarregando."],
    ["INVALID_REPORT_RANGE", "A data inicial precisa ser anterior à data final."],
  ])("maps %s", (code, expected) => {
    expect(messageForError(apiError(code))).toBe(expected);
  });

  it("falls back on an unmapped code", () => {
    expect(messageForError(apiError("SOMETHING_NEW"))).toBe(UNKNOWN_ERROR_MESSAGE);
  });

  it("says how long the quota blocks", () => {
    expect(messageForError(apiError("RATE_LIMIT_EXCEEDED", { retryAfterSeconds: 30 }))).toBe(
      "Muitas requisições. Tente novamente em 30 segundos."
    );
  });

  it("never surfaces the english prose of the server", () => {
    for (const code of ["INSUFFICIENT_PERMISSIONS", "SOMETHING_NEW"]) {
      expect(messageForError(apiError(code))).not.toContain("Insufficient permissions");
    }
  });
});
