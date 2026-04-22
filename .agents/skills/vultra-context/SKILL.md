---
name: vultra-context
description: >
  Master anti-hallucination reference for the VULTRA project. Contains ALL architecture rules,
  patterns, prohibitions, and project-specific decisions for the complete Vultra ecosystem
  (API Core, database, auth, biometrics, AI service, frontend portals, firmware).
  Use this skill whenever implementing, creating, modifying, or reviewing ANY part of Vultra —
  new routes, queries, use cases, schemas, components, migrations, firmware code, or
  anything related to the project. Invoke whenever the user says: implementar, criar rota,
  escrever query, novo use case, construir, adicionar endpoint, criar componente, migration,
  schema TypeBox, repositório, controller, middleware, portal, firmware, ESP32, Redis queue,
  embedding, biometria, presença, chamada, or any implementation request in the Vultra context.
---

# VULTRA — Master Context Skill

> Read this entire SKILL.md before generating any code. Then load the relevant reference file(s)
> for the domain you're working in. The rules here override any generic knowledge.

---

## Project Snapshot

VULTRA is a **multitenant SaaS** for biometric attendance management and organisational wellness
analysis, using facial recognition (vector similarity) and real-time sentiment analysis.
Target: educational institutions and HR departments. Compliance: **LGPD (Lei 13.709/2018)**,
enterprise-grade. Runtime: **Bun**. Framework: **ElysiaJS + TypeBox**. Auth: **Better Auth**.
DB: **PostgreSQL 16 + pgvector**. AI: **Python + FastAPI + DeepFace**. Hardware: **ESP32-CAM**.

---

## 🚫 PROHIBITIONS — Never Do These

These are hard rules derived from ADRs and architectural decisions. Violating any one of them is
a critical defect.

| # | NEVER DO | Reason |
|---|----------|--------|
| 1 | Use **Zod, Joi, or Yup** for validation | TypeBox is the only validation library (ADR-001). Zod creates a translation layer that breaks ElysiaJS type-safety end-to-end |
| 2 | Use **`any`** in TypeScript | Strict mode is mandatory. Use explicit interfaces. `any` bypasses compile-time safety in a security-critical system |
| 3 | **Store biometric images** (raw, processed, or base64) anywhere persistent | LGPD Art. 11. Only `vector(512)` embeddings are stored. Images are processed in RAM and immediately discarded |
| 4 | Run **`drizzle-kit generate`** or any ORM migration generator | Migrations are raw SQL files in `/migrations`. ORM generators produce unsafe DDL and break RLS policies |
| 5 | Read **`organizationId`** from request body, URL params, or query string | It MUST come from `currentOrg` injected by the authenticated `derive`. User-supplied tenant IDs are a P0 data-leak vector |
| 6 | Store **`api_key_hash`** or any device token as plaintext | Only bcrypt hash stored. Verified via `Bun.password.verify()`. Plaintext shown once at creation, never persisted |
| 7 | Expose **stack traces** in production API responses | `globalErrorHandler` maps DomainErrors to HTTP codes. Unknown errors return `500` with no internal details |
| 8 | Import from **`adapters/`** or **`infrastructure/`** inside **`core/`** | Hexagonal rule: core knows nothing about adapters. Use interfaces (ports). Implementations live in `adapters/repositories/` |
| 9 | Use **`prepare: true`** (prepared statements) with PostgreSQL queries | PostgreSQL prepared statements bypass `set_config()` calls, breaking Row Level Security |
| 10 | Register a **fallback attendance silently** when the Circuit Breaker is OPEN | Violates auditability (ADR-003). Return `503` with `retryAfter`. Never create phantom records |
| 11 | Change **`DEEPFACE_MODEL`** or `model_version` without a re-enrollment impact analysis | Changing the model invalidates ALL existing embeddings. Requires physical re-enrollment of every member (no stored images per LGPD) |
| 12 | Accept enrollment frames with **`quality_score < 0.5`** | Hard reject at enrollment. Recommended minimum: 0.7. Low-quality embeddings cause false positives at recognition |
| 13 | Return **`face_embedding` vectors** in any API response | Embeddings are internal biometric data. Never serialise them to HTTP responses |
| 14 | Create routes **without the `/v1/` prefix** | All API routes must be versioned. Prefix defined at app level: `/v1/` |
| 15 | Pass **context (currentUser, currentOrg, db)** as function parameters to handlers | Context is injected via `.derive()`. Handlers destructure from the Elysia context object |
| 16 | Use **`DELETE` or `UPDATE` on `audit_logs`** | The table has an immutability trigger. Any attempt raises an exception. Audit logs are append-only |
| 17 | Use **`uuid_generate_v4()`** for new primary keys | Use `gen_uuid_v7()` (custom PL/pgSQL function, migration 0001). UUID v7 has temporal ordering in B-Trees |
| 18 | Display **biometric raw data** (vectors, embeddings, raw scores) in any frontend portal | Portals show only labels, aggregated scores, and human-readable metrics |
| 19 | Use **`drizzle-kit push`** or direct schema sync in production | Never sync schema from ORM in production. Always use numbered SQL migration files |
| 20 | Skip the **`model_version` filter** in biometric similarity queries | A member can have profiles from multiple models. Without this filter, cross-model comparisons produce nonsense scores |

---

## ✅ REQUIREMENTS — Always Do These

| # | ALWAYS DO | Reason |
|---|-----------|--------|
| 1 | Filter **every** database query by `organization_id` | Multitenant isolation is a P0 requirement. Cross-tenant data leaks are critical security failures |
| 2 | Declare TypeBox **`body`, `params`, `query`, and `response`** schemas in every route | Elysia uses TypeBox for runtime validation AND compile-time type inference. Missing schema = unvalidated input |
| 3 | Register **`globalErrorHandler` as the FIRST plugin** in the Elysia bootstrap | It must catch errors from ALL subsequent plugins and routes. Out-of-order registration creates unhandled exceptions |
| 4 | Use **UUID v7** (`gen_uuid_v7()`) for all new primary keys | Temporal ordering improves B-Tree performance for time-series inserts (attendance_records) |
| 5 | Use **soft-delete** (`deleted_at`) for members, not hard DELETE | LGPD retention requirements. Data must be retained for the defined period before physical deletion |
| 6 | Snapshot **`match_threshold`** in every `attendance_record` | The threshold is configurable per tenant. Snapshotting allows post-hoc auditing of false positives with historical context |
| 7 | Write an **`audit_log` entry** for all sensitive operations (enroll, delete member, rotate key) | LGPD Art. 6 (accountability). Audit logs are immutable and preserved even after tenant deletion |
| 8 | Use **Conventional Commits** (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`) with scope | Team convention and CI/CD pipeline depend on this format |
| 9 | Keep **`core/`** free of framework/infra imports | Domain logic must be testable without starting the server, connecting to Redis, or loading env vars |
| 10 | Use **`Bun.password.verify()`** for device token comparison | Timing-safe bcrypt verification. Never use string equality for secret comparison |

---

## Architecture Map

```
apps/api-core/src/
├── core/                    ← Domain (zero external deps)
│   ├── domain/
│   │   ├── entities/        ← Attendance, Member, Organization
│   │   ├── value-objects/   ← FaceEmbedding (vector 512), ConfidenceScore
│   │   └── errors/          ← DomainError, AttendanceConflictError
│   └── use-cases/           ← RecordAttendanceUseCase, EnrollBiometricUseCase
│
├── adapters/                ← Ports & Adapters (implement core interfaces)
│   ├── http/                ← adapters HTTP Elysia do estado atual
│   │   ├── attendance.routes.ts
│   │   ├── biometric.routes.ts
│   │   ├── health.routes.ts
│   │   ├── auth.plugin.ts
│   │   └── device-auth.plugin.ts
│   ├── repositories/        ← AttendanceRepository, BiometricRepository
│   └── queue/               ← AIJobQueue.ts (Redis publisher)
│
└── infrastructure/          ← Bootstrap, config, DI
    ├── server.ts            ← Bun.serve() + Elysia mount
    ├── database.ts          ← PostgreSQL + pgvector client
    ├── redis.ts             ← Redis client
    ├── auth.ts              ← Better Auth initialisation
    └── container.ts         ← Manual DI container

IMPORT RULES:
  core/ → nothing external
  adapters/ → core/ interfaces + infrastructure/ clients
  infrastructure/ → any layer
  FORBIDDEN: core/ importing from adapters/ or infrastructure/
```

---

## Reference Files — Load When Relevant

| File | Load when working on... |
|------|------------------------|
| `references/backend.md` | ElysiaJS routes, TypeBox schemas, Use Cases, error handling, Redis queue, bootstrap |
| `references/database.md` | Drizzle queries, migrations, pgvector, multitenancy, RLS, audit_logs, partitioning |
| `references/auth.md` | Better Auth setup, RBAC, session handling, IoT device auth, guards |
| `references/biometrics-lgpd.md` | Biometric enrollment/recognition, LGPD compliance, RAM-only processing, embeddings |
| `references/frontend.md` | Next.js portals, Shadcn/UI components, TanStack Query, shared TypeBox types |
| `references/conventions.md` | File naming, class naming, interface naming, commit format, route prefixes, DB columns |

> When in doubt, load all relevant files. Each is under 300 lines.
