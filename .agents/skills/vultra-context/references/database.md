# Database Reference — Schema, Multitenancy, pgvector, Migrations

## Tables Quick Reference

| Table | PK type | Key constraints |
|-------|---------|----------------|
| `organizations` | UUID v7 | `slug` UNIQUE; `plan` CHECK ('trial','pro','enterprise') |
| `members` | UUID v7 | `organization_id` FK; soft-delete via `deleted_at`; GIN trigram on `full_name` |
| `biometric_profiles` | UUID v7 | `organization_id` FK; `face_embedding vector(512)`; HNSW index; UNIQUE (member_id, model_version) WHERE is_active |
| `attendance_sessions` | UUID v7 | `organization_id` FK; `status` CHECK ('open','closed','cancelled'); 1 open per device |
| `attendance_records` | UUID v7 | Partitioned by `recorded_at` (quarterly); PK=(id, recorded_at); UNIQUE (session_id, member_id, recorded_at) → 409 |
| `devices` | UUID v7 | `organization_id` FK; `api_key_hash` UNIQUE (bcrypt); `is_active` soft disable |
| `audit_logs` | BIGSERIAL | No FK on `organization_id` (intentional — preserves history after tenant deletion); UPDATE/DELETE blocked by trigger |

## Primary Keys — Always Use UUID v7

```sql
-- Correct
INSERT INTO members (id, organization_id, ...) VALUES (gen_uuid_v7(), $1, ...);

-- Wrong — uuid_generate_v4() has no temporal ordering
INSERT INTO members (id, ...) VALUES (uuid_generate_v4(), ...);
```

## Multitenancy — 3-Layer Protection

1. **Application layer** — every query includes `WHERE organization_id = $orgId`
2. **RLS** — `set_config('app.current_org_id', orgId, true)` called before every transaction; policies on all tables enforce this
3. **Auth layer** — `currentOrg` injected by `derive`, never from request input

```typescript
// adapters/repositories/AttendanceRepository.ts — correct pattern
async findBySession(sessionId: string, orgId: string) {
  return db.query(
    `SELECT * FROM attendance_records
     WHERE session_id = $1 AND organization_id = $2`,  // ← always filter by orgId
    [sessionId, orgId],
    { prepare: false }  // ← required for RLS compatibility
  );
}
```

## pgvector — Similarity Queries

```sql
-- Find closest biometric profile by cosine similarity
-- ALWAYS filter by organization_id AND model_version
SELECT
  bp.member_id,
  bp.face_embedding <=> $1::vector AS distance,
  1 - (bp.face_embedding <=> $1::vector) AS similarity
FROM biometric_profiles bp
WHERE bp.organization_id = $2
  AND bp.model_version = $3        -- ← mandatory: cross-model scores are meaningless
  AND bp.is_active = TRUE
ORDER BY bp.face_embedding <=> $1::vector
LIMIT 1;

-- Threshold check in application (default: 0.85 cosine similarity)
-- Snapshot match_threshold in attendance_record at insert time
```

Operators:
- `<=>` — cosine distance (1 - similarity). Use for face recognition.
- `<->` — Euclidean (L2) distance. Use only if model was trained with L2.
- HNSW index uses `vector_cosine_ops` — queries must use `<=>` to benefit from it.

## `attendance_records` Partitioning

Table is `PARTITION BY RANGE (recorded_at)` — quarterly partitions:
- `attendance_records_2025_q1`, `..._q2`, ... up to `2027_q2`
- `attendance_records_overflow` — catches dates outside defined range
- **PK is composite**: `(id, recorded_at)` — required by PostgreSQL for partitioned tables
- RLS defined on parent table is **automatically inherited** by all partitions (existing and future)
- Queries should always include `recorded_at` range filter to benefit from partition pruning

## `audit_logs` — Append-Only

```typescript
// Always insert, never update or delete
await db.query(
  `INSERT INTO audit_logs
     (organization_id, actor_id, actor_type, action, resource_type, resource_id, payload, ip_address)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
  [orgId, actorId, actorType, action, resourceType, resourceId, payload, ipAddress],
  { prepare: false }
);

// Action naming convention: ENTITY_VERB_PAST
// Examples: ATTENDANCE_RECORD_CREATED, MEMBER_DELETED, BIOMETRIC_PROFILE_ENROLLED,
//           DEVICE_KEY_ROTATED, BIOMETRIC_PROFILE_REVOKED
```

## Migration Policy

- **Never** use `drizzle-kit generate`, `drizzle-kit push`, or any ORM schema sync
- Migrations are sequential SQL files: `0001_init_extensions_uuid_v7.sql`, `0002_...`, etc.
- Each migration is irreversible (append-only). Never edit an applied migration.
- To change schema: create a new numbered migration file
- Migrations directory: `apps/api-core/migrations/`

## PostgreSQL Extensions (all enabled in migration 0001)

| Extension | Purpose |
|-----------|---------|
| `uuid-ossp` | Legacy compatibility (`uuid_generate_v4()`) |
| `vector` (pgvector) | `vector(N)` type and `<=>`, `<->` operators |
| `pg_trgm` | Trigram similarity for member name autocomplete |
| `btree_gin` | Composite GIN indexes on JSONB (settings, audit payload) |

## `set_updated_at()` Trigger

All tables with `updated_at` use a `BEFORE UPDATE` trigger that calls `set_updated_at()`.
Never manually set `updated_at` in application code.
