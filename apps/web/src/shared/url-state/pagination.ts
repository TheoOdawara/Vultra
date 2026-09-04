export const PAGE_SIZE = 50;

export const CURSOR_PARAM = "cursor";

export const CURSOR_STACK_PARAM = "cursorStack";

export interface PaginationState {
  cursor: string | null;
  cursorStack: string[];
}

export const FIRST_PAGE: PaginationState = { cursor: null, cursorStack: [] };

export function goToNextPage(state: PaginationState, nextCursor: string | null): PaginationState {
  if (nextCursor === null) return state;

  return {
    cursor: nextCursor,
    cursorStack: state.cursor === null ? [] : [...state.cursorStack, state.cursor],
  };
}

export function goToPreviousPage(state: PaginationState): PaginationState {
  const cursorStack = [...state.cursorStack];
  const previous = cursorStack.pop();

  return { cursor: previous ?? null, cursorStack };
}

export function canGoNext(nextCursor: string | null): boolean {
  return nextCursor !== null;
}

export function canGoPrevious(state: PaginationState): boolean {
  return state.cursor !== null;
}

export function encodeCursorStack(cursorStack: string[]): string | null {
  return cursorStack.length === 0 ? null : cursorStack.join("~");
}

export function decodeCursorStack(raw: string | null | undefined): string[] {
  if (raw === null || raw === undefined || raw === "") return [];
  return raw.split("~").filter((entry) => entry !== "");
}
