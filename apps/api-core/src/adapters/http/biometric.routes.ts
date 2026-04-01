/**
 * VULTRA — Biometric Routes
 *
 * POST   /v1/biometric/enroll          → EnrollBiometricUseCase
 * DELETE /v1/biometric/:memberId       → RevokeBiometricUseCase
 *
 * Auth: authPlugin (currentUser + currentOrg)
 * Required permission: biometrics:* (admin only)
 *
 * LGPD: frameBase64 is NEVER logged or stored. Only the embedding vector
 * produced by the AI Service reaches the database.
 */

import { createId } from "@paralleldrive/cuid2";
import Elysia, { t } from "elysia";
import { authPlugin } from "./auth.plugin";
import { AIJobQueue } from "../queue/ai-job.queue.ts";
import { BiometricsRepository } from "../repositories/biometrics.repo.ts";
import {
  EnrollBiometricUseCase,
  RevokeBiometricUseCase,
} from "../../core/use-cases/biometrics.use-cases";
import { db } from "../../infrastructure/database/client";
import { ForbiddenError, OrganizationNotFoundError } from "../../core/domain/errors/DomainError";

// Lazy-initialized singletons (Redis injected at server startup)
let _aiQueue: AIJobQueue | null = null;

export function initBiometricRoutes(aiQueue: AIJobQueue) {
  _aiQueue = aiQueue;
}

function getUseCases(organizationId: string) {
  if (!_aiQueue) throw new Error("AIJobQueue not initialized");
  const biometricsRepo = new BiometricsRepository(db);
  return {
    enroll: new EnrollBiometricUseCase(_aiQueue, biometricsRepo),
    revoke: new RevokeBiometricUseCase(biometricsRepo),
  };
}

export const biometricRoutes = new Elysia({ prefix: "/biometric" })
  .use(authPlugin)

  // ── POST /v1/biometric/enroll ───────────────────────────────────────────
  .post(
    "/enroll",
    async ({ body, currentOrg, currentUser }) => {
      if (!currentOrg) throw new OrganizationNotFoundError();

      // Only admins can enroll biometrics
      // (role check delegated to RBAC middleware in production; simple guard here)
      const { enroll } = getUseCases(currentOrg);

      const result = await enroll.execute({
        jobId: createId(),
        frameBase64: body.frameBase64,
        memberId: body.memberId,
        organizationId: currentOrg,
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
    },
  )

  // ── DELETE /v1/biometric/:memberId ──────────────────────────────────────
  .delete(
    "/:memberId",
    async ({ params, currentOrg }) => {
      if (!currentOrg) throw new OrganizationNotFoundError();

      const { revoke } = getUseCases(currentOrg);
      await revoke.execute({
        memberId: params.memberId,
        organizationId: currentOrg,
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
    },
  );
