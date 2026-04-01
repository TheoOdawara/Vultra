/**
 * VULTRA — AIJobQueue Adapter
 *
 * Implements IAIQueueAdapter with a Redis-based Circuit Breaker.
 *
 * Circuit Breaker states (ADR-003):
 *   CLOSED    → normal operation, jobs published to Redis
 *   OPEN      → fast-fail, 503 returned immediately (cooldown: 30s)
 *   HALF_OPEN → one test job allowed through; success → CLOSED, fail → OPEN
 *
 * Circuit state is stored in Redis (not memory) so multiple API instances
 * share the same state consistently.
 */

import { createId } from "@paralleldrive/cuid2";
import type { Redis } from "ioredis";
import {
  AIJobTimeoutError,
  AIServiceUnavailableError,
} from "../../core/domain/errors/DomainError";
import type {
  AIJobResult,
  CircuitHealth,
  CircuitState,
  IAIQueueAdapter,
} from "../../core/ports/IAIQueueAdapter";

// ── Circuit Breaker config (ADR-003) ──────────────────────────────────────────

const CB_FAILURE_THRESHOLD = 5;    // consecutive failures to open circuit
const CB_SUCCESS_THRESHOLD = 2;    // consecutive successes in HALF_OPEN to close
const CB_COOLDOWN_MS = 30_000;     // 30s before OPEN → HALF_OPEN transition
const JOB_TIMEOUT_MS = 3_000;      // max wait for AI result
const RESULT_POLL_INTERVAL_MS = 50; // polling interval for result key
const RESULT_TTL_S = 60;

// Redis keys
const CB_STATE_KEY = "vultra:circuit:ai:state";         // "CLOSED" | "OPEN" | "HALF_OPEN"
const CB_FAILURE_COUNT_KEY = "vultra:circuit:ai:failures";
const CB_LAST_FAILURE_KEY = "vultra:circuit:ai:last_failure";
const CB_OPEN_AT_KEY = "vultra:circuit:ai:open_at";
const CB_HALF_OPEN_SUCCESSES_KEY = "vultra:circuit:ai:half_open_successes";

export class AIJobQueue implements IAIQueueAdapter {
  constructor(
    private readonly redis: Redis,
    private readonly queueName: string = "ai:recognition:queue",
    private readonly resultPrefix: string = "ai:recognition:result:",
  ) {}

  // ── Public API ────────────────────────────────────────────────────────────

  async enqueueAndAwait(params: {
    jobId: string;
    frameBase64: string;
    organizationId: string;
    deviceId?: string;
  }): Promise<AIJobResult> {
    await this._guardCircuit();

    const job = JSON.stringify({
      job_id: params.jobId,
      frame_base64: params.frameBase64,
      organization_id: params.organizationId,
      device_id: params.deviceId ?? null,
    });

    await this.redis.lpush(this.queueName, job);

    try {
      const result = await this._awaitResult(params.jobId);
      await this._recordSuccess();
      return result;
    } catch (err) {
      await this._recordFailure();
      throw err;
    }
  }

  async getCircuitState(): Promise<CircuitState> {
    return this._resolveState();
  }

  async getCircuitHealth(): Promise<CircuitHealth> {
    const state = await this._resolveState();
    const failures = parseInt((await this.redis.get(CB_FAILURE_COUNT_KEY)) ?? "0", 10);
    const lastFailure = await this.redis.get(CB_LAST_FAILURE_KEY);

    return {
      status: state === "CLOSED" ? "ok" : state === "HALF_OPEN" ? "degraded" : "unavailable",
      circuitState: state,
      failureCount: failures,
      lastFailureAt: lastFailure,
    };
  }

  // ── Circuit Breaker internals ─────────────────────────────────────────────

  private async _resolveState(): Promise<CircuitState> {
    const stored = (await this.redis.get(CB_STATE_KEY)) as CircuitState | null;
    if (!stored || stored === "CLOSED") return "CLOSED";

    if (stored === "OPEN") {
      const openAt = parseInt((await this.redis.get(CB_OPEN_AT_KEY)) ?? "0", 10);
      if (Date.now() - openAt >= CB_COOLDOWN_MS) {
        // Cooldown elapsed → transition to HALF_OPEN
        await this.redis.set(CB_STATE_KEY, "HALF_OPEN");
        await this.redis.set(CB_HALF_OPEN_SUCCESSES_KEY, "0");
        return "HALF_OPEN";
      }
      return "OPEN";
    }

    return "HALF_OPEN";
  }

  private async _guardCircuit(): Promise<void> {
    const state = await this._resolveState();
    if (state === "OPEN") {
      const openAt = parseInt((await this.redis.get(CB_OPEN_AT_KEY)) ?? "0", 10);
      const retryAfter = Math.max(0, Math.ceil((openAt + CB_COOLDOWN_MS - Date.now()) / 1000));
      throw new AIServiceUnavailableError(retryAfter);
    }
    // HALF_OPEN: allow the request through as a test probe
  }

  private async _recordSuccess(): Promise<void> {
    const state = await this._resolveState();

    if (state === "HALF_OPEN") {
      const successes = await this.redis.incr(CB_HALF_OPEN_SUCCESSES_KEY);
      if (successes >= CB_SUCCESS_THRESHOLD) {
        // Enough consecutive successes → close circuit
        await this.redis.set(CB_STATE_KEY, "CLOSED");
        await this.redis.del(CB_FAILURE_COUNT_KEY, CB_OPEN_AT_KEY, CB_HALF_OPEN_SUCCESSES_KEY);
      }
    } else {
      // CLOSED — reset failure counter on success
      await this.redis.set(CB_FAILURE_COUNT_KEY, "0");
    }
  }

  private async _recordFailure(): Promise<void> {
    const failures = await this.redis.incr(CB_FAILURE_COUNT_KEY);
    await this.redis.set(CB_LAST_FAILURE_KEY, new Date().toISOString());

    const state = await this._resolveState();

    // Open circuit if threshold reached (from CLOSED or HALF_OPEN)
    if (state !== "OPEN" && failures >= CB_FAILURE_THRESHOLD) {
      await this.redis.set(CB_STATE_KEY, "OPEN");
      await this.redis.set(CB_OPEN_AT_KEY, Date.now().toString());
    }
  }

  // ── Result polling ────────────────────────────────────────────────────────

  private async _awaitResult(jobId: string): Promise<AIJobResult> {
    const resultKey = `${this.resultPrefix}${jobId}`;
    const deadline = Date.now() + JOB_TIMEOUT_MS;

    while (Date.now() < deadline) {
      const raw = await this.redis.get(resultKey);
      if (raw) {
        await this.redis.del(resultKey); // consume result
        const parsed = JSON.parse(raw);

        if (parsed.error) {
          // AI service returned a structured error code
          throw Object.assign(new Error(parsed.error), { errorCode: parsed.error });
        }

        return {
          embedding: parsed.embedding as number[],
          qualityScore: parsed.quality_score as number,
          processingMs: parsed.processing_ms as number,
        };
      }
      await new Promise((r) => setTimeout(r, RESULT_POLL_INTERVAL_MS));
    }

    throw new AIJobTimeoutError();
  }
}
