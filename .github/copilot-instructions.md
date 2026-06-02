# VULTRA — Copilot Instructions

Diretrizes comportamentais e regras técnicas obrigatórias para o projeto VULTRA.
Combina boas práticas gerais de codificação com restrições específicas do projeto.

---

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals before implementing.
State a brief plan for multi-step tasks with verification checkpoints.

---

## 5. VULTRA Mandatory Technical Rules

The rules below are **non-negotiable** and override any general best practice.

### Schema Validation

- **TypeBox is mandatory** for route schemas in API Core (Elysia + TypeBox).
- **Zod, Joi, and Yup are forbidden** across the entire project (backend and frontends).
- Frontend form validation must use native HTML5, React Hook Form without Zod, or `@vultra/types`.

### Multi-tenancy & Data Security

- **RLS (Row Level Security) and tenant context are mandatory** in all database queries.
- Every repository must call `withTenantContext` before any query.
- Application-level `organizationId` filters are defense-in-depth — they do not replace RLS.
- TanStack Query keys must include `activeOrganizationId` to prevent cross-tenant cache.

### LGPD & Biometrics

- **No biometric image may be persisted** — JPEG frames are processed entirely in RAM by the AI Service and discarded immediately.
- Raw biometric data (embeddings) must never appear in logs, API responses, or storage.
- Operations affecting sensitive personal data must generate an **audit log** entry.

### Audit Logs

Sensitive operations must produce entries in `audit_logs`:
- Member deactivation
- Biometric profile revocation
- Device key rotation
- Any deletion or deactivation operation

### RBAC & Authentication

- **Better Auth + organization plugin** is the canonical authentication system.
- RBAC is enforced via `checkPermission(role, { resource: [actions] })`.
- Routes must never bypass RBAC or RLS.
- Frontend middlewares must validate both session **and** portal-specific role.

### Migrations & Database

- **SQL migrations are manual** — never use `drizzle-kit push` in production.
- Migrations live in `apps/api-core/src/infrastructure/database/migrations/`.
- Never modify schema without a corresponding migration.

### API Endpoints & Contracts

- Canonical routes (per `docs/backend/manuais/api-endpoints.md`):
  - ESP32: `POST /v1/attendance/record` (with `X-Device-Token`)
  - Close session: `PATCH /v1/attendance/sessions/:id/close`
  - Manual attendance: `POST /v1/attendance/sessions/:id/records/manual`
  - List faces: `GET /v1/face/list`
- The `/v1/biometric/*` surface is discontinued (returns 404).
- Never create API contracts that diverge from `@vultra/types`.

### ADRs

- **Accepted ADRs must not be edited directly.**
- If a decision needs revision, create a new ADR or a versioned errata.

### Line Endings

- All files must use **LF** (Unix). Do not commit files with CRLF.
- `git diff --check origin/main...HEAD` must pass without errors.
