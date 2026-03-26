# Backend Reference — ElysiaJS, TypeBox, Hexagonal Architecture

## Bootstrap Order (Mandatory)

```typescript
// infrastructure/server.ts
const app = new Elysia()
  .use(globalErrorHandler)   // ← FIRST — catches errors from all plugins below
  .use(authMiddleware)        // ← injects currentUser, currentOrg
  .use(attendanceRoutes)      // ← /v1/attendance/...
  .use(membersRoutes)         // ← /v1/members/...
  .use(devicesRoutes)         // ← /v1/devices/...
  .use(biometricRoutes)       // ← /v1/biometric/...
  .use(reportsRoutes)         // ← /v1/reports/...
  .use(healthRoutes);         // ← /v1/health/...
```

## Route Pattern — Every Route Must Follow This

Schemas live in `adapters/http/schemas/`, never inline in route files.

```typescript
// adapters/http/schemas/attendance.schema.ts
export const RecordAttendanceBodySchema = t.Object({
  sessionId:   t.String({ format: "uuid" }),
  frameBase64: t.String(),
});

export const RecordAttendanceResponseSchema = t.Object({
  recordId:        t.String(),
  confidenceScore: t.Number(),
  sentimentLabel:  t.Optional(t.String()),
});

// adapters/http/routes/attendance.routes.ts
new Elysia({ prefix: "/attendance" })
  .post(
    "/record",
    async ({ body, currentOrg, container }) =>
      container.recordAttendanceUseCase.execute({ ...body, organizationId: currentOrg }),
    {
      body:     RecordAttendanceBodySchema,
      response: RecordAttendanceResponseSchema,
    }
  );
```

## `derive` Pattern — Context Injection

Never call `auth.api.getSession()` inside handlers. Always via `derive`.

```typescript
// infrastructure/auth.ts
export const authDerive = async ({ headers }: { headers: Headers }) => {
  const session = await auth.api.getSession({ headers });
  if (!session) throw new UnauthorizedError();
  return {
    currentUser: session.user,
    currentOrg:  session.session.activeOrganizationId,
  };
};

// Usage in route plugin:
.derive(authDerive)
.get("/me", ({ currentUser }) => currentUser)  // currentUser is fully typed
```

## Use Case Design — Interface-Based DI

```typescript
// core/use-cases/RecordAttendanceUseCase.ts
export class RecordAttendanceUseCase {
  constructor(
    private readonly aiQueue:     IAIQueueAdapter,
    private readonly biometricRepo: IBiometricRepository,
    private readonly attendanceRepo: IAttendanceRepository,
  ) {}

  async execute(input: RecordAttendanceInput): Promise<RecordAttendanceOutput> {
    // 1. Enqueue frame → get embedding + sentiment from AI Service
    // 2. Find closest member by cosine similarity (pgvector <=>)
    // 3. Check for duplicate in session → throw AttendanceConflictError (→ HTTP 409)
    // 4. Persist attendance_record (no image, only metadata + scores)
  }
}
```

All Use Cases:
- Receive interfaces via constructor (never concrete implementations)
- Expose only `execute()` as public method
- Live in `core/use-cases/`
- Throw typed `DomainError` subclasses, never raw `Error`

## Error Handling

`globalErrorHandler` maps `DomainError` subclasses to HTTP codes:

| DomainError subclass | HTTP code | When |
|----------------------|-----------|------|
| `UnauthorizedError` | 401 | No valid session |
| `ForbiddenError` | 403 | Insufficient RBAC permission |
| `NotFoundError` | 404 | Resource not found |
| `AttendanceConflictError` | 409 | Duplicate record in same session |
| `ValidationError` | 422 | Business-rule validation failure |
| `AIServiceUnavailableError` | 503 | Circuit Breaker OPEN |

Unknown errors → `500` with generic message. Never expose internal details.

## RBAC Guard Usage

```typescript
// Protect a route requiring a specific permission
.derive(authDerive)
.derive(requirePermission("attendance:write"))
.post("/record", handler, { body: ..., response: ... })
```

## Route Prefixes

| Domain | Prefix | Example |
|--------|--------|---------|
| Attendance sessions | `/v1/attendance/sessions` | `POST /v1/attendance/sessions` |
| Attendance records | `/v1/attendance/records` | `GET /v1/attendance/records?sessionId=` |
| Members | `/v1/members` | `GET /v1/members` |
| Devices | `/v1/devices` | `POST /v1/devices` |
| Biometric profiles | `/v1/biometric` | `POST /v1/biometric/enroll` |
| Reports | `/v1/reports` | `GET /v1/reports/attendance` |
| Health | `/v1/health` | `GET /v1/health/ai-service` |

## Redis Queue — AI Job Pattern

```typescript
// adapters/queue/AIJobQueue.ts
// 1. LPUSH job payload → 'vultra:ai:queue'
// 2. Poll result key 'vultra:ai:result:<jobId>' with BLPOP + jobTimeout (3000ms)
// 3. Circuit Breaker wraps step 1 — if OPEN, throw AIServiceUnavailableError immediately
// Never await AI results inline in handlers — Use Case handles the async flow
```

Circuit Breaker parameters (ADR-003):
- `failureThreshold`: 5 consecutive failures → OPEN
- `jobTimeout`: 3000ms
- `cooldownPeriod`: 30s
- `successThreshold`: 2 consecutive successes → CLOSED from HALF-OPEN
- State stored in Redis for multi-instance consistency
