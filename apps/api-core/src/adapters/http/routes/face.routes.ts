/**
 * VULTRA — Face Routes
 *
 * POST   /v1/face/enroll      → EnrollBiometricUseCase
 * POST   /v1/face/verify      → VerifyFaceUseCase
 * GET    /v1/face/list        → ListFacesUseCase
 * DELETE /v1/face/:profileId  → RevokeBiometricUseCase
 *
 * Auth: authPlugin (user session + org)
 * RBAC:  checkPermission(role, { biometrics: [action] })
 *
 * LGPD: frameBase64 is NEVER logged or stored.
 */

import { createId } from "@paralleldrive/cuid2";
import Elysia, { t } from "elysia";
import {
  ForbiddenError,
  OrganizationNotFoundError,
  PayloadTooLargeError,
  RateLimitExceededError,
} from "../../../core/domain/errors/DomainError";
import { EnrollBiometricUseCase } from "../../../core/use-cases/biometrics/EnrollBiometricUseCase";
import { ListFacesUseCase } from "../../../core/use-cases/biometrics/ListFacesUseCase";
import { RevokeBiometricUseCase } from "../../../core/use-cases/biometrics/RevokeBiometricUseCase";
import { VerifyFaceUseCase } from "../../../core/use-cases/biometrics/VerifyFaceUseCase";
import { checkPermission } from "../../../infrastructure/auth";
import { db } from "../../../infrastructure/database/client";
import type { AIJobQueue } from "../../queue/ai-job.queue.ts";
import { AuditLogRepository } from "../../repositories/audit-log.repository";
import { BiometricsRepository } from "../../repositories/biometric.repository";
import { authPlugin } from "../middleware/auth.plugin";

const MAX_FRAME_BASE64_BYTES = 1024 * 1024;
const USER_RATE_LIMIT_MAX_HITS = 10;
const ORG_RATE_LIMIT_MAX_HITS = 20;
const RATE_LIMIT_WINDOW_MS = 1_000;
const RATE_LIMIT_BLOCK_MS = 60_000;
const PROFILE_ID_PATTERN =
  "^(?:profile-[0-9]+|profile-[a-z0-9]+(?:-[a-z0-9]+)+|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$";

type RateLimitBucket = {
  hits: number[];
  blockedUntil: number;
};

type BiometricAction = "enroll" | "verify" | "list" | "delete";

// ── Singletons (built once when initFaceRoutes is called) ─────────────────────

let _enroll: EnrollBiometricUseCase | null = null;
let _verify: VerifyFaceUseCase | null = null;
let _list: ListFacesUseCase | null = null;
let _revoke: RevokeBiometricUseCase | null = null;
const userRateLimitBuckets = new Map<string, RateLimitBucket>();
const orgRateLimitBuckets = new Map<string, RateLimitBucket>();

export function initFaceRoutes(aiQueue: AIJobQueue): void {
  const biometricsRepo = new BiometricsRepository(db);
  const auditLogRepo = new AuditLogRepository(db);

  _enroll = new EnrollBiometricUseCase(aiQueue, biometricsRepo, auditLogRepo);
  _verify = new VerifyFaceUseCase(aiQueue, biometricsRepo, auditLogRepo);
  _list = new ListFacesUseCase(biometricsRepo);
  _revoke = new RevokeBiometricUseCase(biometricsRepo, auditLogRepo);

  userRateLimitBuckets.clear();
  orgRateLimitBuckets.clear();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveCurrentRole(
  currentUser: ({ role?: string } & Record<string, unknown>) | null | undefined,
  currentRole?: string | null
): string | null {
  return currentRole ?? currentUser?.role ?? null;
}

function ensureBiometricPermission(role: string | null, action: BiometricAction) {
  if (!checkPermission(role, { biometrics: [action] })) {
    throw new ForbiddenError();
  }
}

function getOrCreateBucket(store: Map<string, RateLimitBucket>, key: string): RateLimitBucket {
  const current = store.get(key);
  if (current) return current;

  const bucket: RateLimitBucket = { hits: [], blockedUntil: 0 };
  store.set(key, bucket);
  return bucket;
}

function enforceBucketLimit(
  store: Map<string, RateLimitBucket>,
  key: string,
  maxHits: number,
  now = Date.now()
) {
  const bucket = getOrCreateBucket(store, key);

  if (bucket.blockedUntil > now) {
    throw new RateLimitExceededError(Math.max(1, Math.ceil((bucket.blockedUntil - now) / 1_000)));
  }

  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  bucket.hits = bucket.hits.filter((hit) => hit > windowStart);

  if (bucket.hits.length >= maxHits) {
    bucket.blockedUntil = now + RATE_LIMIT_BLOCK_MS;
    bucket.hits = [];
    throw new RateLimitExceededError(Math.ceil(RATE_LIMIT_BLOCK_MS / 1_000));
  }

  bucket.hits.push(now);
}

function enforceRateLimit(userId: string, organizationId: string) {
  enforceBucketLimit(userRateLimitBuckets, userId, USER_RATE_LIMIT_MAX_HITS);
  enforceBucketLimit(orgRateLimitBuckets, organizationId, ORG_RATE_LIMIT_MAX_HITS);
}

function ensureFrameSize(frameBase64: string) {
  if (new TextEncoder().encode(frameBase64).byteLength > MAX_FRAME_BASE64_BYTES) {
    throw new PayloadTooLargeError();
  }
}

function serializeDate(value: Date | string | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function serializeRequiredDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function resolveIpAddress(request: Request): string | undefined {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const [firstIp] = forwardedFor.split(",");
    const ipAddress = firstIp?.trim();
    if (ipAddress) return ipAddress;
  }
  return request.headers.get("x-real-ip") ?? undefined;
}

// ── Route tree ────────────────────────────────────────────────────────────────

export const faceRoutes = new Elysia()
  .use(authPlugin)
  .derive({ as: "scoped" }, ({ currentOrg, currentRole, currentUser }) => {
    if (!currentOrg) throw new OrganizationNotFoundError();

    const role = resolveCurrentRole(currentUser, currentRole);
    const currentUserId = currentUser?.id;

    if (!currentUserId) throw new ForbiddenError();

    return {
      currentOrg,
      currentRole: role,
      currentUserId,
      requireBiometricAccess(action: BiometricAction) {
        ensureBiometricPermission(role, action);
        enforceRateLimit(currentUserId, currentOrg);
      },
    };
  })
  .post(
    "/face/enroll",
    async ({ body, currentOrg, currentUserId, request, requireBiometricAccess, set }) => {
      requireBiometricAccess("enroll");
      ensureFrameSize(body.frameBase64);
      if (!_enroll) throw new Error("FaceRoutes not initialized");

      const ipAddress = resolveIpAddress(request);
      const result = await _enroll.execute({
        jobId: createId(),
        frameBase64: body.frameBase64,
        memberId: body.memberId,
        organizationId: currentOrg,
        actorId: currentUserId,
        actorType: "user",
        ...(ipAddress ? { ipAddress } : {}),
      });

      set.status = 201;
      return result;
    },
    {
      body: t.Object(
        {
          memberId: t.String({ format: "uuid" }),
          frameBase64: t.String({ minLength: 1 }),
        },
        { additionalProperties: false }
      ),
      response: {
        201: t.Object({
          profileId: t.String(),
          qualityScore: t.Number({ minimum: 0, maximum: 1 }),
          modelVersion: t.String(),
          processingMs: t.Number({ minimum: 0 }),
        }),
      },
    }
  )
  .post(
    "/face/verify",
    async ({ body, currentOrg, currentUserId, request, requireBiometricAccess }) => {
      requireBiometricAccess("verify");
      ensureFrameSize(body.frameBase64);
      if (!_verify) throw new Error("FaceRoutes not initialized");

      const ipAddress = resolveIpAddress(request);
      return _verify.execute({
        jobId: createId(),
        frameBase64: body.frameBase64,
        organizationId: currentOrg,
        actorId: currentUserId,
        actorType: "user",
        ...(ipAddress ? { ipAddress } : {}),
        ...(body.memberId ? { memberId: body.memberId } : {}),
      });
    },
    {
      body: t.Object(
        {
          frameBase64: t.String({ minLength: 1 }),
          memberId: t.Optional(t.String({ format: "uuid" })),
        },
        { additionalProperties: false }
      ),
      response: t.Object({
        result: t.Union([t.Literal("MATCH"), t.Literal("POSSÍVEL"), t.Literal("SEM_MATCH")]),
        memberId: t.Optional(t.String()),
        confidence: t.Number({ minimum: 0, maximum: 1 }),
        processingMs: t.Number({ minimum: 0 }),
      }),
    }
  )
  .get(
    "/face/list",
    async ({ query, currentOrg, requireBiometricAccess }) => {
      requireBiometricAccess("list");
      if (!_list) throw new Error("FaceRoutes not initialized");

      const profiles = await _list.execute({
        organizationId: currentOrg,
        ...(query.memberId ? { memberId: query.memberId } : {}),
      });

      return profiles.map((profile) => ({
        ...profile,
        enrolledAt: serializeRequiredDate(profile.enrolledAt),
        lastMatchedAt: serializeDate(profile.lastMatchedAt),
        deletedAt: serializeDate(profile.deletedAt),
      }));
    },
    {
      query: t.Object(
        { memberId: t.Optional(t.String({ format: "uuid" })) },
        { additionalProperties: false }
      ),
      response: t.Array(
        t.Object({
          profileId: t.String(),
          organizationId: t.String(),
          memberId: t.String(),
          modelVersion: t.String(),
          qualityScore: t.Number({ minimum: 0, maximum: 1 }),
          isActive: t.Boolean(),
          deviceId: t.Nullable(t.String()),
          createdBy: t.Nullable(t.String()),
          enrolledAt: t.String(),
          lastMatchedAt: t.Nullable(t.String()),
          deletedAt: t.Nullable(t.String()),
          deletedBy: t.Nullable(t.String()),
        })
      ),
    }
  )
  .delete(
    "/face/:profileId",
    async ({ params, currentOrg, currentUserId, request, requireBiometricAccess }) => {
      requireBiometricAccess("delete");
      if (!_revoke) throw new Error("FaceRoutes not initialized");

      const ipAddress = resolveIpAddress(request);
      await _revoke.execute({
        profileId: params.profileId,
        organizationId: currentOrg,
        deletedBy: currentUserId,
        actorId: currentUserId,
        actorType: "user",
        ...(ipAddress ? { ipAddress } : {}),
      });

      return { success: true };
    },
    {
      params: t.Object({
        profileId: t.String({ pattern: PROFILE_ID_PATTERN }),
      }),
      response: t.Object({ success: t.Boolean() }),
    }
  );
