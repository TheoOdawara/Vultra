# Auth Reference — Better Auth, RBAC, IoT Devices

## Better Auth Initialisation

Better Auth is initialised in `infrastructure/auth.ts` with four plugins:

| Plugin | Key config |
|--------|-----------|
| `organization` | Organisation creation restricted to super-admin only |
| `rbac` | Permissions defined per role (see matrix below) |
| `passkeys` | WebAuthn (FIDO2) passkey support |
| `multiSession` | Maximum **3 concurrent sessions** per user |

## RBAC Permission Matrix

| Role | `attendance:write` | `attendance:read` | `reports:read` | `members:manage` | `admin:*` |
|------|:-----------------:|:-----------------:|:--------------:|:----------------:|:---------:|
| `admin` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `professor` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `rh` | ❌ | ✅ | ✅ | ❌ | ❌ |
| `student` | ❌ | ❌ | ❌ | ❌ | ❌ |

Role is checked via `ctx.currentUser.role` (injected by `derive`).

## User Authentication — `derive` Pattern

```typescript
// infrastructure/auth.ts
export const authDerive = async ({ headers }: { headers: Headers }) => {
  const session = await auth.api.getSession({ headers });
  if (!session) throw new UnauthorizedError();
  return {
    currentUser: session.user,               // typed user object
    currentOrg:  session.session.activeOrganizationId,  // tenant ID
  };
};

// ✅ Correct: context injected, handler uses it directly
.derive(authDerive)
.get("/members", ({ currentOrg }) => membersRepo.list(currentOrg))

// ❌ Wrong: calling getSession inside handler
.get("/members", async ({ headers }) => {
  const session = await auth.api.getSession({ headers }); // never do this in handlers
})
```

## RBAC Guard

```typescript
// adapters/http/middleware/auth.middleware.ts
export const requirePermission = (permission: string) =>
  async ({ currentUser }: { currentUser: User }) => {
    if (!hasPermission(currentUser.role, permission)) throw new ForbiddenError();
  };

// Usage
.derive(authDerive)
.derive(requirePermission("members:manage"))
.post("/members", handler, { body: CreateMemberBodySchema, response: MemberResponseSchema })
```

## IoT Device Authentication (ESP32-CAM)

ESP32 devices do NOT use JWT. They authenticate via `X-Device-Token` header.

### Validation Flow

```
Request with X-Device-Token header
  ↓
deviceAuthMiddleware extracts header value
  ↓
Query: SELECT * FROM devices WHERE organization_id = $orgId AND id = $deviceId
  ↓
Bun.password.verify(receivedToken, device.api_key_hash)
  ↓
If valid → inject authenticatedDevice via derive
If invalid → throw UnauthorizedError → HTTP 401 INVALID_DEVICE_TOKEN
```

```typescript
// adapters/http/middleware/device.middleware.ts
export const deviceAuthMiddleware = async ({ headers, db }: Context) => {
  const token = headers.get("X-Device-Token");
  if (!token) throw new UnauthorizedError();

  const deviceId = headers.get("X-Device-Id");
  const device = await db.query(
    "SELECT * FROM devices WHERE id = $1 AND is_active = TRUE",
    [deviceId],
    { prepare: false }
  );
  if (!device || !await Bun.password.verify(token, device.api_key_hash)) {
    throw new UnauthorizedError("INVALID_DEVICE_TOKEN");
  }
  return { authenticatedDevice: device };
};
```

### API Key Security Rules

- The plaintext `apiKey` is shown **once only** in the Admin Portal at device creation time
- Only `api_key_hash` (bcrypt) is stored in the `devices` table
- Key rotation: generate new hash → old key invalidated immediately (no grace period)
- Never log `X-Device-Token` header values

## Route Protection Summary

| Route type | Middleware applied | Context injected |
|------------|--------------------|-----------------|
| User routes | `authMiddleware` | `currentUser`, `currentOrg` |
| Device routes | `deviceAuthMiddleware` | `authenticatedDevice` |
| Admin routes (`/v1/admin/`) | `authMiddleware` + `requireRole('admin')` | `currentUser` |
| Public routes | — | — |
