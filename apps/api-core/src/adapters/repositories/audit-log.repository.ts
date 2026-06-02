import type {
  IAuditLogRepository,
  InsertAuditLogParams,
} from "../../core/ports/IAuditLogRepository";
import { withTenantContext } from "../../infrastructure/database/client.ts";
import type { Db, Tx } from "../../infrastructure/database/client.ts";
import { auditLogs } from "../../infrastructure/database/schema/audit-logs.ts";

export class AuditLogRepository implements IAuditLogRepository {
  constructor(private readonly db: Db) {}

  async insert(params: InsertAuditLogParams): Promise<void> {
    await withTenantContext(this.db, params.organizationId, async (tx: Tx) => {
      await tx.insert(auditLogs).values({
        organizationId: params.organizationId,
        actorId: params.actorId,
        actorType: params.actorType,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        payload: sanitizeAuditPayload(params.payload),
        ...(params.ipAddress ? { ipAddress: params.ipAddress } : {}),
      });
    });
  }
}

const SENSITIVE_AUDIT_KEYS = new Set([
  "apikey",
  "apikeyplaintext",
  "embedding",
  "faceembedding",
  "faceembeddingvector",
  "frame",
  "framebase64",
  "key",
  "rawframe",
  "token",
  "xapikey",
  "xdevicetoken",
]);

function sanitizeAuditPayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeAuditPayload);
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value).filter(
      ([key]) => !SENSITIVE_AUDIT_KEYS.has(normalizeAuditPayloadKey(key))
    );

    return Object.fromEntries(entries.map(([key, item]) => [key, sanitizeAuditPayload(item)]));
  }

  return value;
}

function normalizeAuditPayloadKey(key: string): string {
  return key.replace(/[-_]/g, "").toLowerCase();
}
