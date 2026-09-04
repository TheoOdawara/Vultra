import type { AuditLog } from "../domain.js";
import type { Collection, CursorQuery, SortDirection } from "../pagination.js";

export interface ListAuditLogsQuery extends CursorQuery {
  action?: string;
  resourceType?: string;
  resourceId?: string;
  actorId?: string;
  from?: string;
  to?: string;
  sort?: "createdAt";
  direction?: SortDirection;
}

export type ListAuditLogsResponse = Collection<AuditLog>;
