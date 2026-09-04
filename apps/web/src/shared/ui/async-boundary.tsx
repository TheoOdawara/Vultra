import type { ApiError } from "@/shared/api/errors";
import { type AsyncStatus, deriveAsyncStatus } from "./async-state";
import { EmptyState, type EmptyStateProps } from "./empty-state";
import { ErrorState } from "./error-state";

export interface AsyncBoundaryProps {
  isLoading: boolean;
  error: ApiError | null;
  isEmpty: boolean;
  skeleton: React.ReactNode;
  empty: Omit<EmptyStateProps, "filtered"> & { filtered: boolean };
  onRetry: () => void;
  children: React.ReactNode;
}

export function AsyncBoundary({
  isLoading,
  error,
  isEmpty,
  skeleton,
  empty,
  onRetry,
  children,
}: AsyncBoundaryProps) {
  const status: AsyncStatus = deriveAsyncStatus({ isLoading, error, isEmpty });

  if (status === "loading") {
    return (
      <div data-slot="async-boundary" data-status="loading" aria-busy="true" aria-live="polite">
        {skeleton}
      </div>
    );
  }

  if (status === "error" && error !== null) {
    return (
      <div data-slot="async-boundary" data-status="error">
        <ErrorState error={error} onRetry={onRetry} />
      </div>
    );
  }

  if (status === "empty") {
    return (
      <div data-slot="async-boundary" data-status="empty">
        <EmptyState {...empty} />
      </div>
    );
  }

  return (
    <div data-slot="async-boundary" data-status="success">
      {children}
    </div>
  );
}
