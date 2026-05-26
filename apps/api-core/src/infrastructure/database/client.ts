/**
 * VULTRA — Database Client
 *
 * Drizzle ORM client over node-postgres.
 * withTenantContext() sets app.current_org_id for RLS enforcement —
 * must be called at the start of every authenticated request.
 */

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

export const db = drizzle(pool, { schema });

export type Db = typeof db;

/**
 * Injects the tenant organization ID into the PostgreSQL session variable
 * consumed by RLS policies:
 *   organization_id = current_setting('app.current_org_id')::uuid
 *
 * Must be called inside every authenticated request before any query.
 * The TRUE flag makes the setting transaction-scoped (not session-persistent).
 *
 * Usage (in repository layer, not use cases):
 *   await withTenantContext(db, organizationId, async () => {
 *     return repo.findAll();
 *   });
 */
export async function withTenantContext<T>(
  database: Db,
  organizationId: string,
  fn: () => Promise<T>
): Promise<T> {
  return database.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_org_id', ${organizationId}, TRUE)`);
    return fn();
  });
}
