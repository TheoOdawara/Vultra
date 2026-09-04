"use client";

import { useCallback, useState } from "react";
import type { ApiError } from "@/shared/api/errors";
import { CORRELATION_ID_HINT, messageForError } from "@/shared/api/errors";
import { Button } from "./button";

export interface ErrorStateProps {
  error: ApiError;
  onRetry: () => void;
}

export function ErrorState({ error, onRetry }: ErrorStateProps) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    void navigator.clipboard.writeText(error.correlationId).then(
      () => setCopied(true),
      () => setCopied(false)
    );
  }, [error.correlationId]);

  return (
    <div
      data-slot="error-state"
      className="flex flex-col items-center gap-4 px-6 py-12 text-center"
      aria-live="assertive"
    >
      <p className="text-sm text-foreground">{messageForError(error)}</p>
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <code className="rounded-sm bg-accent px-2 py-1 text-xs text-muted">
            {error.correlationId}
          </code>
          <Button type="button" variant="outline" size="sm" onClick={copy}>
            {copied ? "Copiado" : "Copiar"}
          </Button>
        </div>
        <p className="text-xs text-muted">{CORRELATION_ID_HINT}</p>
      </div>
      <Button type="button" onClick={onRetry}>
        Tentar de novo
      </Button>
    </div>
  );
}
