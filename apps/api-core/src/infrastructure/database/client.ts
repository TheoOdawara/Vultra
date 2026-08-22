/**
 * VULTRA — Database Client
 *
 * Drizzle ORM client over node-postgres.
 * withTenantContext() sets app.current_org_id for RLS enforcement —
 * must be called in every repository method that queries a tenant-isolated table.
 */

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../../shared/infra/env/env.ts";
import * as schema from "./schema";

const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

export const db = drizzle(pool, { schema });

export type Db = typeof db;

/**
 * Transaction client type derived from Db — stays in sync with Drizzle versions,
 * no `any` required.
 */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Injects the tenant organization ID into the PostgreSQL session variable
 * consumed by RLS policies:
 *   organization_id = current_setting('app.current_org_id')::uuid
 *
 * The TRUE flag makes the setting transaction-scoped. All queries inside fn()
 * MUST use the tx parameter — never this.db — otherwise they run on a different
 * pool connection where the config variable is not set.
 *
 * Usage (in repository layer, not use cases):
 *   return withTenantContext(this.db, organizationId, async (tx) => {
 *     return tx.select()...
 *   });
 */
export async function withTenantContext<T>(
  database: Db,
  organizationId: string,
  fn: (tx: Tx) => Promise<T>
): Promise<T> {
  return database.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_org_id', ${organizationId}, TRUE)`);
    return fn(tx);
  });
}
