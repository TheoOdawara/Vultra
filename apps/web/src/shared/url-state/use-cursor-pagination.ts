"use client";

import { useCallback, useMemo } from "react";
import {
  CURSOR_PARAM,
  CURSOR_STACK_PARAM,
  canGoNext,
  canGoPrevious,
  decodeCursorStack,
  encodeCursorStack,
  goToNextPage,
  goToPreviousPage,
  type PaginationState,
} from "./pagination";

export interface CursorPagination {
  state: PaginationState;
  hasPrevious: boolean;
  hasNext: boolean;
  goNext: () => void;
  goPrevious: () => void;
  resetToFirstPage: () => void;
}

type Setter = (patch: Record<string, string | undefined>) => void;

export function useCursorPagination(
  values: { cursor?: string | undefined; cursorStack?: string | undefined },
  setValues: Setter,
  nextCursor: string | null
): CursorPagination {
  const state = useMemo<PaginationState>(
    () => ({
      cursor: values.cursor ?? null,
      cursorStack: decodeCursorStack(values.cursorStack),
    }),
    [values.cursor, values.cursorStack]
  );

  const write = useCallback(
    (next: PaginationState) => {
      setValues({
        [CURSOR_PARAM]: next.cursor ?? undefined,
        [CURSOR_STACK_PARAM]: encodeCursorStack(next.cursorStack) ?? undefined,
      });
    },
    [setValues]
  );

  const goNext = useCallback(() => {
    write(goToNextPage(state, nextCursor));
  }, [nextCursor, state, write]);

  const goPrevious = useCallback(() => {
    write(goToPreviousPage(state));
  }, [state, write]);

  const resetToFirstPage = useCallback(() => {
    write({ cursor: null, cursorStack: [] });
  }, [write]);

  return {
    state,
    hasPrevious: canGoPrevious(state),
    hasNext: canGoNext(nextCursor),
    goNext,
    goPrevious,
    resetToFirstPage,
  };
}
