/**
 * VULTRA — Composição da aplicação ElysiaJS
 *
 * Ordem de montagem obrigatória (docs/backend/arquitetura/hexagonal.md):
 *   globalErrorHandler → CORS → auth routes (Better Auth) → /v1 routes
 *
 * Todas as rotas de negócio são prefixadas com /v1 (copilot-instructions.md §5).
 */

import { Elysia }    from 'elysia';
import { cors }      from '@elysiajs/cors';
import { auth }      from './infrastructure/auth';
import { globalErrorHandler } from './infrastructure/error-handler';

export const app = new Elysia()
  // ── 1. Handler global de erros — DEVE ser o primeiro plugin ──────────────
  .use(globalErrorHandler)

  // ── 2. CORS — origens confiáveis via env var ──────────────────────────────
  .use(
    cors({
      origin: process.env['BETTER_AUTH_TRUSTED_ORIGINS']?.split(',') ?? [],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Token', 'X-Organization-Id'],
      credentials: true,
    })
  )

  // ── 3. Rotas Better Auth (/api/auth/*) ─────────────────────────────────────
  // Montado sem prefixo: Better Auth já responde em /api/auth/* internamente
  // (basePath padrão = /api/auth, configurado via BETTER_AUTH_URL).
  .mount(auth.handler)

  // ── 4. Grupo /v1 — rotas de domínio (módulos adicionados aqui) ────────────
  .group('/v1', (app) =>
    app
      // Placeholder: módulos de domínio serão injetados aqui em Fase 6+
      // Ex: .use(membersRoutes)
      //     .use(devicesRoutes)
      //     .use(attendanceRoutes)
  );
