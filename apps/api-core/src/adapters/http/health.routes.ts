/**
 * VULTRA — Health Routes
 *
 * GET /v1/health/ai-service → Circuit Breaker state for Portal Admin
 *
 * No auth required (public health endpoint).
 */

import Elysia, { t } from "elysia";
import type { AIJobQueue } from "../queue/ai-job.queue.ts";

let _aiQueue: AIJobQueue | null = null;

export function initHealthRoutes(aiQueue: AIJobQueue) {
  _aiQueue = aiQueue;
}

export const healthRoutes = new Elysia({ prefix: "/health" }).get(
  "/ai-service",
  async () => {
    if (!_aiQueue) {
      return {
        status: "unavailable" as const,
        circuitState: "OPEN" as const,
        failureCount: 0,
        lastFailureAt: null,
      };
    }
    return _aiQueue.getCircuitHealth();
  },
  {
    response: t.Object({
      status: t.Union([t.Literal("ok"), t.Literal("degraded"), t.Literal("unavailable")]),
      circuitState: t.Union([
        t.Literal("CLOSED"),
        t.Literal("OPEN"),
        t.Literal("HALF_OPEN"),
      ]),
      failureCount: t.Number({ minimum: 0 }),
      lastFailureAt: t.Nullable(t.String()),
    }),
    detail: {
      summary: "AI Service circuit breaker health",
      tags: ["ops"],
    },
  },
);
