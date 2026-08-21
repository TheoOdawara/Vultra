/**
 * VULTRA — Server Composition
 *
 * Plugin mount order is MANDATORY (docs/backend/arquitetura/hexagonal.md):
 *   1. httpPlugin          → correlation id, error shape and request log
 *   2. cors()              → must precede auth to handle OPTIONS correctly
 *   3. mount(auth.handler) → Better Auth at /api/auth/*
 *   4. .group('/v1', ...)  → all domain routes with version prefix
 *
 * Redis and AIJobQueue singletons live in infrastructure/redis.ts and
 * infrastructure/container.ts respectively. They are injected here.
 */

import cors from "@elysiajs/cors";
import Elysia from "elysia";
import {
  attendanceDeviceRoutes,
  attendanceUserRoutes,
  initAttendanceRoutes,
} from "../adapters/http/routes/attendance.routes";
import { deviceRoutes, initDeviceRoutes } from "../adapters/http/routes/devices.routes";
import { faceRoutes, initFaceRoutes } from "../adapters/http/routes/face.routes";
import { healthRoutes, initHealthRoutes } from "../adapters/http/routes/health.routes";
import { initMemberRoutes, memberRoutes } from "../adapters/http/routes/members.routes";
import { initReportRoutes, reportRoutes } from "../adapters/http/routes/reports.routes";
import { env } from "../shared/infra/env/env.ts";
import { httpPlugin } from "../shared/infra/http/http.plugin.ts";
import { auth } from "./auth";
import { aiQueue } from "./container";

// ── Inject AIJobQueue into route modules ──────────────────────────────────────

initFaceRoutes(aiQueue);
initAttendanceRoutes(aiQueue);
initHealthRoutes(aiQueue);

// ── Init modules that don't need AIJobQueue ───────────────────────────────────

initMemberRoutes();
initDeviceRoutes();
initReportRoutes();

// ── App composition ───────────────────────────────────────────────────────────

export const app = new Elysia()
  // 1. Global error handler — must be first
  .use(httpPlugin)

  // 2. CORS — before auth
  .use(
    cors({
      origin: [...env.trustedOrigins],
      credentials: true,
    })
  )

  // 3. Better Auth handler — /api/auth/*
  .mount(auth.handler)

  // 4. Domain routes under /v1
  .group("/v1", (v1) =>
    v1
      .use(attendanceUserRoutes)
      .use(attendanceDeviceRoutes)
      .use(faceRoutes)
      .use(memberRoutes)
      .use(deviceRoutes)
      .use(reportRoutes)
      .use(healthRoutes)
  );
