export interface PageInfo {
  nextCursor: string | null;
  limit: number;
}

export interface Collection<T> {
  items: T[];
  page: PageInfo;
}

export type SortDirection = "asc" | "desc";

export interface CursorQuery {
  cursor?: string;
  limit?: number;
}
