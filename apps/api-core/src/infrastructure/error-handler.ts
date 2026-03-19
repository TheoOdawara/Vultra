/**
 * VULTRA — Handler global de erros ElysiaJS
 *
 * Montado como PRIMEIRO plugin no bootstrap da aplicação (app.ts).
 * Mapeia DomainError e erros de framework para respostas HTTP semânticas.
 *
 * Prioridade de tratamento:
 *  1. DomainError e subclasses → httpStatus + errorCode + message
 *  2. Erros de validação TypeBox (ValidationError) → 400 VALIDATION_ERROR
 *  3. Fallback → 500 INTERNAL_SERVER_ERROR (sem stack trace em produção)
 *
 * Referência: docs/backend/manuais/error-handler.md
 */

import { Elysia } from "elysia";
import { DomainError } from "../core/domain/errors/DomainError";

const isProd = process.env.NODE_ENV === "production";

export const globalErrorHandler = new Elysia({ name: "global-error-handler" }).onError(
  ({ error, code, set }) => {
    // ── 1. Erros de domínio conhecidos ─────────────────────────────────────
    if (error instanceof DomainError) {
      set.status = error.httpStatus;
      return {
        error: error.errorCode,
        message: error.message,
      };
    }

    // ── 2. Erros de validação TypeBox (400) ────────────────────────────────
    if (code === "VALIDATION") {
      set.status = 400;
      return {
        error: "VALIDATION_ERROR",
        message: isProd ? "Dados de entrada inválidos." : error.message,
      };
    }

    // ── 3. NOT_FOUND de rota (404) ─────────────────────────────────────────
    if (code === "NOT_FOUND") {
      set.status = 404;
      return { error: "NOT_FOUND" };
    }

    // ── 4. Fallback genérico (500) — nunca expor stack em produção ─────────
    set.status = 500;
    if (!isProd) {
      // biome-ignore lint/suspicious/noConsole: log de debug intencional apenas em desenvolvimento
      console.error("[VULTRA] Erro não tratado:", error);
    }
    return {
      error: "INTERNAL_SERVER_ERROR",
    };
  }
);
