/**
 * VULTRA — IAuditLogRepository Port
 *
 * Contract consumed by Biometrics Use Cases for compliance logging.
 * Implementations live in adapters/repositories/.
 * Use Cases NEVER import concrete classes.
 */

// ── Domain types ──────────────────────────────────────────────────────────────

export type AuditActorType = "user" | "device" | "system";

export type AuditLogAction =
  | "BIOMETRIC_PROFILE_ENROLLED"
  | "BIOMETRIC_PROFILE_VERIFIED"
  | "BIOMETRIC_PROFILE_REVOKED";

type AuditLogPayload = Record<string, unknown>;

export interface InsertAuditLogParams {
  organizationId: string;
  actorId: string | null;
  actorType: AuditActorType;
  action: AuditLogAction;
  resourceType: string;
  resourceId: string | null;
  payload: AuditLogPayload;
  ipAddress?: string;
}

// ── Port interface ────────────────────────────────────────────────────────────

export interface IAuditLogRepository {
  insert(params: InsertAuditLogParams): Promise<void>;
}
