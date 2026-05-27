/**
 * VULTRA — IAuditLogRepository Port
 *
 * Contract consumed by Use Cases for compliance logging.
 * Implementations live in adapters/repositories/.
 * Use Cases NEVER import concrete classes.
 *
 * Action naming convention: ENTITY_PAST_VERB
 * Examples: MEMBER_CREATED, DEVICE_DEACTIVATED, BIOMETRIC_PROFILE_REVOKED
 */

// ── Domain types ──────────────────────────────────────────────────────────────

export type AuditActorType = "user" | "device" | "system";

export type AuditLogAction =
  // Biometrics
  | "BIOMETRIC_PROFILE_ENROLLED"
  | "BIOMETRIC_PROFILE_VERIFIED"
  | "BIOMETRIC_PROFILE_REVOKED"
  // Devices
  | "DEVICE_REGISTERED"
  | "DEVICE_KEY_ROTATED"
  | "DEVICE_DEACTIVATED"
  // Members
  | "MEMBER_CREATED"
  | "MEMBER_UPDATED"
  | "MEMBER_DEACTIVATED";

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
