import { QueryClient } from "@tanstack/react-query";
import { ApiClientError } from "./api";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // Reports are less volatile
      retry: (failureCount, error) => {
        if (error instanceof ApiClientError && error.status < 500) return false;
        return failureCount < 1;
      },
    },
    mutations: { retry: 0 },
  },
});
