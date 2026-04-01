/**
 * VULTRA — IAIQueueAdapter Port
 *
 * Interface consumed by Use Cases. Implementations live in adapters/queue/.
 * Use Cases never import concrete implementations.
 */

export interface AIJobResult {
  embedding: number[];      // 512-dimensional ArcFace vector
  qualityScore: number;     // [0, 1]
  processingMs: number;
}

export interface IAIQueueAdapter {
  /**
   * Enqueue a frame for processing and await the embedding result.
   * Throws AIServiceUnavailableError when circuit is OPEN.
   * Throws AIJobTimeoutError when the job times out.
   */
  enqueueAndAwait(params: {
    jobId: string;
    frameBase64: string;
    organizationId: string;
    deviceId?: string;
  }): Promise<AIJobResult>;

  /**
   * Returns the current circuit breaker state for health monitoring.
   */
  getCircuitState(): Promise<CircuitState>;
}

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitHealth {
  status: "ok" | "degraded" | "unavailable";
  circuitState: CircuitState;
  failureCount: number;
  lastFailureAt: string | null;
}
