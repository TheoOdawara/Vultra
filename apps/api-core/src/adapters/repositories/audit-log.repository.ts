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

function sanitizeAuditPayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeAuditPayload);
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value).filter(
      ([key]) => !["frameBase64", "embedding", "faceEmbedding"].includes(key)
    );

    return Object.fromEntries(entries.map(([key, item]) => [key, sanitizeAuditPayload(item)]));
  }

  return value;
}
