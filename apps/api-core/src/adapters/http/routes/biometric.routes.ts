/**
 * VULTRA — Biometric Routes
 *
 * POST   /v1/biometric/enroll          → EnrollBiometricUseCase
 * DELETE /v1/biometric/:memberId       → RevokeBiometricUseCase
 *
 * Auth: authPlugin (currentUser + currentOrg)
 *
 * LGPD: frameBase64 is NEVER logged or stored. Only the embedding vector
 * produced by the AI Service reaches the database.
 */

import { createId } from "@paralleldrive/cuid2";
import Elysia, { t } from "elysia";
import { OrganizationNotFoundError } from "../../../core/domain/errors/DomainError";
import { EnrollBiometricUseCase } from "../../../core/use-cases/biometrics/EnrollBiometricUseCase";
import { RevokeBiometricUseCase } from "../../../core/use-cases/biometrics/RevokeBiometricUseCase";
import { db } from "../../../infrastructure/database/client";
import type { AIJobQueue } from "../../queue/ai-job.queue.ts";
import { AuditLogRepository } from "../../repositories/audit-log.repository";
import { BiometricsRepository } from "../../repositories/biometric.repository";
import { authPlugin } from "../middleware/auth.plugin";

// ── Singletons (built once when initBiometricRoutes is called) ────────────────

let _enroll: EnrollBiometricUseCase | null = null;
let _revoke: RevokeBiometricUseCase | null = null;

export function initBiometricRoutes(aiQueue: AIJobQueue): void {
  const biometricsRepo = new BiometricsRepository(db);
  const auditLogRepo = new AuditLogRepository(db);

  _enroll = new EnrollBiometricUseCase(aiQueue, biometricsRepo, auditLogRepo);
  _revoke = new RevokeBiometricUseCase(biometricsRepo, auditLogRepo);
}

export const biometricRoutes = new Elysia({ prefix: "/biometric" })
  .use(authPlugin)

  // ── POST /v1/biometric/enroll ───────────────────────────────────────────
  .post(
    "/enroll",
    async ({ body, currentOrg, currentUser }) => {
      if (!currentOrg) throw new OrganizationNotFoundError();
      if (!_enroll) throw new Error("BiometricRoutes not initialized");

      const actorId = currentUser?.id ?? body.memberId;

      const result = await _enroll.execute({
        jobId: createId(),
        frameBase64: body.frameBase64,
        memberId: body.memberId,
        organizationId: currentOrg,
        actorId,
        actorType: "user",
      });

      return {
        profileId: result.profileId,
        qualityScore: result.qualityScore,
        modelVersion: result.modelVersion,
        processingMs: result.processingMs,
      };
    },
    {
      body: t.Object({
        memberId: t.String({ format: "uuid", description: "UUID of the member to enroll" }),
        frameBase64: t.String({ minLength: 1, description: "JPEG frame as base64 — never stored" }),
      }),
      response: t.Object({
        profileId: t.String(),
        qualityScore: t.Number({ minimum: 0, maximum: 1 }),
        modelVersion: t.String(),
        processingMs: t.Number({ minimum: 0 }),
      }),
      detail: {
        summary: "Enroll biometric profile",
        tags: ["biometric"],
        description:
          "Processes a JPEG frame via AI Service and stores the resulting 512-dim embedding. " +
          "The frame is NEVER persisted (LGPD Art. 11).",
      },
    }
  )

  // ── DELETE /v1/biometric/:memberId ──────────────────────────────────────
  .delete(
    "/:memberId",
    async ({ params, currentOrg, currentUser }) => {
      if (!currentOrg) throw new OrganizationNotFoundError();
      if (!_revoke) throw new Error("BiometricRoutes not initialized");

      const actorId = currentUser?.id ?? params.memberId;

      await _revoke.execute({
        memberId: params.memberId,
        organizationId: currentOrg,
        deletedBy: actorId,
        actorId,
        actorType: "user",
      });

      return { success: true };
    },
    {
      params: t.Object({
        memberId: t.String({ format: "uuid" }),
      }),
      response: t.Object({ success: t.Boolean() }),
      detail: {
        summary: "Revoke biometric profile (LGPD Art. 18, VI)",
        tags: ["biometric"],
        description:
          "Sets is_active = FALSE and nullifies the face_embedding vector. " +
          "Required for LGPD right-to-erasure requests.",
      },
    }
  );
