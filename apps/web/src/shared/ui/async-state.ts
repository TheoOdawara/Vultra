import type { ApiError } from "@/shared/api/errors";

export type AsyncStatus = "loading" | "error" | "empty" | "success";

export interface AsyncStateInput {
  isLoading: boolean;
  error: ApiError | null;
  isEmpty: boolean;
}

export function deriveAsyncStatus({ isLoading, error, isEmpty }: AsyncStateInput): AsyncStatus {
  if (isLoading) return "loading";
  if (error !== null) return "error";
  if (isEmpty) return "empty";
  return "success";
}
