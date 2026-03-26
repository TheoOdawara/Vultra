# Frontend Reference — Next.js Portals

## Three Portals Overview

| Portal | App | Audience | Core Features |
|--------|-----|----------|--------------|
| Admin | `apps/frontend-admin` | Super-admins (Vultra) + Org admins | Tenant management, member CRUD, device registration, RBAC, plan management |
| RH | `apps/frontend-rh` | HR managers, People analysts | Attendance reports, wellness sentiment dashboards, LGPD consent management, data export |
| Professores | `apps/frontend-professores` | Professors, coordinators | Real-time attendance session, class diary, manual override |

## Shared Stack

| Library | Version | Usage |
|---------|---------|-------|
| Next.js | 15.x | App Router — all 3 portals |
| Tailwind CSS | 4.x | Utility-first styling |
| Shadcn/UI | latest | UI primitives (Button, Dialog, Table, Card, etc.) |
| TanStack Query | 5.x | Server state management + cache + background refetch |
| React Hook Form | 7.x | Form state and validation |
| Better Auth Client | — | Session management (shared with API Core) |
| TypeBox | same as API | Shared type definitions via `@vultra/types` package |

## `@vultra/types` — Shared TypeBox Schemas

Types are defined once in the API Core schemas and re-exported from the `@vultra/types` package.
The frontend imports types from there, never redeclares them.

```typescript
// ✅ Correct — import from shared types package
import type { Static } from "@sinclair/typebox";
import { AttendanceRecordSchema } from "@vultra/types";
type AttendanceRecord = Static<typeof AttendanceRecordSchema>;

// ❌ Wrong — duplicating type definitions in frontend
interface AttendanceRecord { sessionId: string; ... }
```

## Privacy Rules in Frontend

- **Never** display raw biometric data: no embeddings, no raw vectors, no base64 images
- Only show: confidence scores, sentiment labels, aggregated metrics, human-readable identifiers
- `organizationId` must come from the authenticated session, never from URL params or query strings

```typescript
// ✅ Correct
const { data: session } = useSession(); // from Better Auth Client
const orgId = session?.user?.activeOrganizationId; // from authenticated context

// ❌ Wrong
const orgId = searchParams.get("orgId"); // NEVER read from URL
const orgId = params.organizationId;     // NEVER from route params unvalidated
```

## TanStack Query — Data Fetching Pattern

```typescript
// Query keys should include orgId to prevent cross-tenant cache collisions
const { data: members } = useQuery({
  queryKey: ["members", orgId],
  queryFn: () => fetchMembers(orgId),
  enabled: !!orgId,
});

// Mutations should invalidate related queries
const { mutate: deleteMember } = useMutation({
  mutationFn: (memberId: string) => apiClient.members.delete(memberId),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ["members", orgId] }),
});
```

## Admin Portal — Key Sections

- **Tenant management**: org creation, plan management, `is_active` toggle
- **Member management**: CRUD with soft-delete, role assignment, external_code (matricula)
- **Device registration**: creates device, shows API key **once only**, never again
- **RBAC**: assign roles to members within an organisation

## RH Portal — Key Sections

- Attendance reports with date/member/session filters
- Wellness dashboard: sentiment aggregates (happy/neutral/sad/angry/surprise/fear/disgust)
- LGPD panel: consent status per member, revocation action
- CSV/Excel export (never includes raw embeddings)

## Professores Portal — Key Sections

- Real-time session view: open session, watch records arrive via WebSocket/polling
- Class diary: historical attendance view per class
- Manual override: mark attendance manually when facial recognition fails (sets `is_manual = TRUE`)

## Auth in Frontend

```typescript
// Better Auth Client setup (shared across portals)
import { createAuthClient } from "better-auth/client";
import { organizationClient, rbacClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  plugins: [organizationClient(), rbacClient()],
});

// Session access
const { data: session, isPending } = authClient.useSession();
```
