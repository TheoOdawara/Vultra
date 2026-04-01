/**
 * VULTRA — Server Composition
 *
 * Plugin mount order is MANDATORY (docs/backend/arquitetura/hexagonal.md):
 *   1. globalErrorHandler  → captures errors from all subsequent plugins
 *   2. cors()              → must precede auth to handle OPTIONS correctly
 *   3. mount(auth.handler) → Better Auth at /api/auth/*
 *   4. .group('/v1', ...)  → all domain routes with version prefix
 *
 * Redis and AIJobQueue are initialized here and injected into route modules.
 */

import cors from "@elysiajs/cors";
import Elysia from "elysia";
import { Redis } from "ioredis";
import { auth } from "./auth";
import { globalErrorHandler } from "./error-handler";
import { AIJobQueue } from "../adapters/queue/ai-job.queue.ts";
import {
  attendanceDeviceRoutes,
  attendanceUserRoutes,
  initAttendanceRoutes,
} from "../adapters/http/attendance.routes";
import { biometricRoutes, initBiometricRoutes } from "../adapters/http/biometric.routes";
import { healthRoutes, initHealthRoutes } from "../adapters/http/health.routes";

if (!process.env.REDIS_URL) {
  throw new Error("REDIS_URL environment variable is required");
}

// ── Infrastructure singletons ─────────────────────────────────────────────────

const redis = new Redis(process.env.REDIS_URL);

redis.on("error", (err) => console.error("[Redis]", err));
redis.on("connect", () => console.info("[Redis] Connected"));

const aiQueue = new AIJobQueue(
  redis,
  process.env.AI_QUEUE_NAME ?? "ai:recognition:queue",
  process.env.AI_RESULT_PREFIX ?? "ai:recognition:result:",
);

// Inject AIJobQueue into route modules
initBiometricRoutes(aiQueue);
initAttendanceRoutes(aiQueue);
initHealthRoutes(aiQueue);

// ── App composition ───────────────────────────────────────────────────────────

export const app = new Elysia()
  // 1. Global error handler — must be first
  .use(globalErrorHandler)

  // 2. CORS — before auth
  .use(
    cors({
      origin: (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      credentials: true,
    }),
  )

  // 3. Better Auth handler — /api/auth/*
  .mount(auth.handler)

  // 4. Domain routes under /v1
  .group("/v1", (v1) =>
    v1
      .use(attendanceUserRoutes)
      .use(attendanceDeviceRoutes)
      .use(biometricRoutes)
      .use(healthRoutes),
  );
