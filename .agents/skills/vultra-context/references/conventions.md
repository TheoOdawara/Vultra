# Conventions Reference — Naming, Commits, Structure

## File Naming

| Scope | Convention | Examples |
|-------|------------|---------|
| All TypeScript files | `kebab-case.ts` | `record-attendance.use-case.ts`, `auth.middleware.ts` |
| All test files | `kebab-case.test.ts` | `record-attendance.use-case.test.ts` |
| All SQL migration files | `NNNN_description.sql` | `0001_init_extensions_uuid_v7.sql`, `0010_add_hnsw_index.sql` |
| Next.js pages (App Router) | `page.tsx`, `layout.tsx` | Standard Next.js conventions |

## TypeScript Naming

| Concept | Convention | Examples |
|---------|------------|---------|
| Classes | `PascalCase` | `RecordAttendanceUseCase`, `BiometricRepository` |
| Interfaces (ports) | `I` prefix + `PascalCase` | `IAttendanceRepository`, `IAIQueueAdapter` |
| TypeBox schemas | `PascalCase` + `Schema` suffix | `RecordAttendanceBodySchema`, `MemberResponseSchema` |
| Use Cases | `PascalCase` + `UseCase` suffix | `EnrollBiometricUseCase`, `GenerateReportUseCase` |
| Repositories | `PascalCase` + `Repository` suffix | `AttendanceRepository`, `MemberRepository` |
| Value Objects | `PascalCase` | `FaceEmbedding`, `ConfidenceScore` |
| Domain Errors | `PascalCase` + `Error` suffix | `AttendanceConflictError`, `UnauthorizedError` |
| Enums | `PascalCase` | `AttendanceStatus`, `SentimentLabel` |
| Constants | `SCREAMING_SNAKE_CASE` | `MAX_SESSIONS_PER_USER`, `DEFAULT_MATCH_THRESHOLD` |

## Database Naming

| Concept | Convention | Examples |
|---------|------------|---------|
| Table names | `snake_case` plural | `attendance_records`, `biometric_profiles` |
| Column names | `snake_case` | `organization_id`, `face_embedding`, `created_at` |
| Constraint names | `tbl_col_type` | `members_email_unique`, `biometric_profiles_member_id_fkey` |
| Trigger names | `trg_tbl_description` | `trg_members_set_updated_at`, `trg_audit_logs_immutable` |
| Function names | `snake_case` verbs | `gen_uuid_v7()`, `set_updated_at()` |
| Index names | `idx_tbl_cols` | `idx_members_org_id`, `idx_biometric_hnsw_embedding` |
| Audit log actions | `ENTITY_VERB_PAST` | `ATTENDANCE_RECORD_CREATED`, `MEMBER_DELETED`, `DEVICE_KEY_ROTATED` |

## Conventional Commits (Mandatory)

Format: `type(scope): description`

| Type | When to use |
|------|------------|
| `feat` | New feature (use case, route, component, migration adding functionality) |
| `fix` | Bug fix |
| `docs` | Documentation changes only |
| `refactor` | Code restructure without behaviour change |
| `chore` | Dependencies, config, CI, tooling |
| `test` | Adding or fixing tests |
| `perf` | Performance improvement |

Scopes (examples): `auth`, `attendance`, `biometric`, `members`, `devices`, `reports`, `database`, `frontend-admin`, `frontend-rh`, `frontend-professores`, `ai-service`, `firmware`

```
feat(attendance): implement cosine similarity search for face recognition
fix(auth): correct X-Device-Token validation on key rotation
docs(database): add ER diagram for biometric_profiles schema
refactor(core): extract FaceEmbedding value object from RecordAttendanceUseCase
chore(deps): upgrade pgvector to 0.8.6
```

## Import Order (TypeScript)

1. Node built-ins (never needed in this project)
2. External packages (`elysia`, `@sinclair/typebox`, `better-auth`, etc.)
3. Internal `@vultra/*` packages (`@vultra/types`)
4. Core layer (`../../core/domain/...`, `../../core/use-cases/...`)
5. Adapter layer (`../repositories/...`, `../http/schemas/...`)
6. Infrastructure layer (`../../infrastructure/...`)
7. Relative siblings (`./auth.schema`, `./members.schema`)

**Forbidden import directions:**
- `core/` → `adapters/` ❌
- `core/` → `infrastructure/` ❌
- Circular imports of any kind ❌

## Folder Structure Quick Reference

```
apps/
├── api-core/
│   ├── src/
│   │   ├── core/domain/entities/
│   │   ├── core/domain/value-objects/
│   │   ├── core/domain/errors/
│   │   ├── core/use-cases/
│   │   ├── adapters/http/routes/
│   │   ├── adapters/http/schemas/
│   │   ├── adapters/http/middleware/
│   │   ├── adapters/repositories/
│   │   ├── adapters/queue/
│   │   └── infrastructure/
│   └── migrations/           ← numbered SQL files only
├── ai-service/               ← Python + FastAPI + DeepFace
├── frontend-admin/           ← Next.js 15 App Router
├── frontend-rh/              ← Next.js 15 App Router
└── frontend-professores/     ← Next.js 15 App Router

firmware/                     ← ESP32-CAM C++/Arduino

docs/
├── backend/
│   ├── adrs/                 ← immutable Architecture Decision Records
│   ├── arquitetura/
│   ├── guias/
│   └── manuais/
├── database/
│   ├── adrs/
│   ├── arquitetura/
│   ├── guias/
│   └── manuais/
└── frontend/
    ├── admin/
    ├── rh/
    └── professores/
```

## ADR Policy

ADRs in `docs/*/adrs/` are **immutable**. They document architectural decisions already taken.
To supersede an ADR, create a new ADR that references and supersedes the old one.
Never edit an existing ADR to change its decision.
