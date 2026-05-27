/**
 * VULTRA — Health API Types
 *
 * Contracts for GET /v1/health/ai-service
 * Consumed by Portal Admin for real-time degradation alerts.
 */

import type { AiServiceStatus, CircuitBreakerState } from "../domain.js";

/** HTTP 200 */
export interface AiServiceHealthResponse {
  /** Human-readable status. */
  status: AiServiceStatus;
  /** Technical circuit breaker state. */
  circuitState: CircuitBreakerState;
  /** Failures accumulated since last reset. */
  failureCount: number;
  /** ISO 8601 timestamp or null if no recent failure. */
  lastFailureAt: string | null;
}
