# Biometrics & LGPD Reference

## LGPD Compliance Table

| LGPD Requirement | Vultra Implementation |
|------------------|-----------------------|
| Data minimisation (Art. 6, III) | Only `vector(512)` embeddings stored. Zero raw images anywhere |
| Security in processing (Art. 46) | TLS 1.3 on all comms; bcrypt for secrets; RLS in DB |
| Right to deletion (Art. 18, VI) | Soft-delete + vector anonimisation (zero the embedding on revocation) |
| Consent (Art. 7) | Explicit consent term per tenant, versioned and timestamped |
| Accountability (Art. 6, X) | Immutable `audit_logs` table; every biometric action logged |
| Sensitive data special regime (Art. 11) | Biometric data is "sensitive" — requires explicit purpose and strict access control |

## RAM-Only Biometric Processing (Art. 11 — Mandatory)

```
ESP32-CAM captures frame
    ↓ (sends base64 in request body, TLS 1.3)
API Core receives frame in RAM
    ↓ (LPUSH to Redis queue — binary only, not persisted)
AI Service (Python) dequeues job
    ↓ (DeepFace.represent() in process memory)
Generates face_embedding float32[512] + sentiment_label + sentiment_score
    ↓ (result published back to Redis result key)
API Core receives embedding via Redis
    ↓
Stores ONLY vector(512) in biometric_profiles
    ↓
Frame binary DISCARDED — never written to disk or DB
```

**Critical:** The original image frame must never be:
- Written to disk (no temp files)
- Stored in any database
- Logged anywhere
- Returned in any API response

## Enrollment Rules

```typescript
// Reject low-quality frames at enrollment
if (qualityScore < 0.5) {
  throw new ValidationError("ENROLLMENT_QUALITY_TOO_LOW");
}
// Warn (but accept) if quality is between 0.5 and 0.7
// Recommended minimum for production: quality_score >= 0.7
```

The `quality_score` from DeepFace must be stored in `biometric_profiles.quality_score`.
It is used in post-hoc audit of false positives.

## Model Version — Critical Rules

```sql
-- biometric_profiles has UNIQUE PARTIAL constraint:
-- UNIQUE (member_id, model_version) WHERE is_active = TRUE
-- This means one active profile per (member, model) pair

-- When doing recognition, ALWAYS filter by model_version:
SELECT face_embedding <=> $1::vector AS distance, member_id
FROM biometric_profiles
WHERE organization_id = $2
  AND model_version = 'ArcFace-v1'   -- ← NEVER omit this
  AND is_active = TRUE
ORDER BY 1 LIMIT 1;
```

Current production model: **ArcFace-v1** (ADR-002).
- Embedding dimensions: 512
- Recommended cosine similarity threshold: **0.85**
- Changing `DEEPFACE_MODEL` requires re-enrollment of ALL members (no stored images → physical re-enrollment)

## Revocation & Right to Deletion

When a member exercises their right to deletion (LGPD Art. 18, VI):

1. Set `biometric_profiles.is_active = FALSE`
2. **Anonymise the embedding**: zero-fill `face_embedding` (`UPDATE ... SET face_embedding = array_fill(0, ARRAY[512])::vector`)
3. Set `members.deleted_at = NOW()`
4. Insert `audit_log` with action `BIOMETRIC_PROFILE_REVOKED` and `MEMBER_DELETED`
5. Do NOT physically delete the `members` row until the LGPD retention period expires

## Consent Management

- Each tenant (`organization`) has a consent term, versioned
- Consent is per-member, stored with version reference and timestamp
- When consent is revoked: trigger the revocation + anonimisation flow above
- Never process biometric data for a member who has revoked consent

## `biometric_profiles` Key Columns Reminder

| Column | Rule |
|--------|------|
| `face_embedding` | `vector(512)` — never return in API responses |
| `model_version` | Always set to current model string (e.g., `'ArcFace-v1'`). Always filter queries by this |
| `quality_score` | REAL [0,1]. Reject enrollment if < 0.5 |
| `is_active` | Set to FALSE on revocation or model migration. Never delete the row |
| `organization_id` | FK — always present for multitenancy isolation |
