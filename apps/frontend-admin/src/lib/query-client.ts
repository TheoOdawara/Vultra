/**
 * VULTRA — TanStack Query client configuration
 *
 * - staleTime: 30s — balance between freshness and request volume
 * - retry: 1 for 5xx; 0 for 4xx (auth/forbidden errors should not retry)
 */

import { QueryClient } from "@tanstack/react-query";
import { ApiClientError } from "./api";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        // Do not retry auth errors or client errors
        if (error instanceof ApiClientError && error.status < 500) return false;
        return failureCount < 1;
      },
    },
    mutations: {
      retry: 0,
    },
  },
});
