import type { CircuitBreakerState } from "../domain.js";

export interface HealthResponse {
  status: "ok";
}

export interface DependenciesHealthResponse {
  aiService: {
    circuitState: CircuitBreakerState;
    failureCount: number;
    lastFailureAt: string | null;
  };
  redis: {
    reachable: boolean;
    lastFailureAt: string | null;
  };
}
