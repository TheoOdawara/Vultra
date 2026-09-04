import type { ApiErrorCode, ApiErrorDetail } from "@vultra/types";

export const UNKNOWN_ERROR_MESSAGE = "Não foi possível concluir a operação. Tente novamente.";

export const CORRELATION_ID_HINT = "Informe este código ao suporte.";

const MESSAGES: Record<string, string> = {
  INSUFFICIENT_PERMISSIONS: "Você não tem permissão para esta ação.",
  INVALID_CURSOR: "A navegação expirou. Voltando para a primeira página.",
  MEMBER_EXTERNAL_CODE_CONFLICT: "Este código externo já está em uso por outro membro ativo.",
  LIVENESS_CHECK_FAILED:
    "A captura não corresponde a uma pessoa presente. Capture novamente, ao vivo.",
  SESSION_ALREADY_CLOSED: "Esta sessão de chamada já foi encerrada.",
  PRECONDITION_FAILED: "A sessão mudou em outro dispositivo. Recarregando.",
  INVALID_REPORT_RANGE: "A data inicial precisa ser anterior à data final.",
};

export interface ApiErrorInit {
  status: number;
  code: ApiErrorCode;
  correlationId: string;
  serverMessage: string;
  details?: ApiErrorDetail[];
  retryAfterSeconds?: number;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly correlationId: string;
  readonly details: ApiErrorDetail[];
  readonly retryAfterSeconds: number | null;

  constructor(init: ApiErrorInit) {
    super(`${init.code} (${init.status})`);
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code;
    this.correlationId = init.correlationId;
    this.details = init.details ?? [];
    this.retryAfterSeconds = init.retryAfterSeconds ?? null;
  }
}

export function messageForError(error: ApiError): string {
  if (error.code === "RATE_LIMIT_EXCEEDED" && error.retryAfterSeconds !== null) {
    return `Muitas requisições. Tente novamente em ${error.retryAfterSeconds} segundos.`;
  }

  return MESSAGES[error.code] ?? UNKNOWN_ERROR_MESSAGE;
}
