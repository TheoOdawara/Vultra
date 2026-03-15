/**
 * VULTRA — Database Client (Drizzle ORM + postgres.js)
 *
 * Exporta:
 *  - `db`                → instância global do cliente Drizzle (connection pool)
 *  - `withTenantContext` → executa operações com RLS isolado por tenant
 *
 * Arquitetura de isolamento multitenant (3 camadas):
 *  1. Aplicação      → filtros WHERE organization_id nos repositórios
 *  2. Banco (RLS)    → set_config('app.current_org_id') + políticas RLS
 *  3. Auth           → currentOrg injetado via derive() do Better Auth
 *
 * IMPORTANTE: `withTenantContext` DEVE ser chamado em TODO endpoint autenticado.
 * O `set_config` usa scope de transação (TRUE) — nunca vaza entre requests.
 *
 * Referência: docs/database/arquitetura/rls.md
 */

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const DATABASE_URL = process.env["DATABASE_URL"];

if (!DATABASE_URL) {
  throw new Error("[database/client] DATABASE_URL não está definida. Verifique o .env");
}

const queryClient = postgres(DATABASE_URL, {
  max: 20, // Tamanho do pool de conexões
  idle_timeout: 30, // Segundos até fechar conexão ociosa
  connect_timeout: 10, // Timeout de conexão inicial
  prepare: false, // Desabilita prepared statements para compatibilidade com RLS set_config
});

export const db = drizzle(queryClient, { schema });

export type Database = typeof db;

// ---------------------------------------------------------------------------
// withTenantContext
// ---------------------------------------------------------------------------

/**
 * Executa `fn` dentro de uma transação com o contexto de tenant configurado.
 *
 * Injeta `app.current_org_id` via `set_config` com escopo de transação (TRUE),
 * ativando as políticas de Row-Level Security para o tenant especificado.
 * Ao término da transação, o contexto é automaticamente invalidado.
 *
 * @param organizationId  UUID do tenant ativo (vem do contexto de auth)
 * @param fn              Callback que recebe o cliente de banco com RLS ativo
 *
 * @example
 * // Em um repositório:
 * const result = await withTenantContext(ctx.organizationId, (tx) =>
 *   tx.select().from(schema.members).where(eq(schema.members.isActive, true))
 * );
 *
 * @throws Se organizationId for inválido ou a transação falhar
 */
export async function withTenantContext<T>(
  organizationId: string,
  fn: (db: Database) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_org_id', ${organizationId}, TRUE)`);

    return fn(tx as unknown as Database);
  });
}

/**
 * Helper para queries de reconhecimento facial com ef_search elevado.
 * Aumenta o recall do índice HNSW durante buscas por embedding.
 *
 * @param efSearch  Tamanho do beam de busca (padrão do índice: 40; recomendado: 80)
 */
export async function withFaceSearchContext<T>(
  organizationId: string,
  efSearch: number = 80,
  fn: (db: Database) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_org_id', ${organizationId}, TRUE)`);
    await tx.execute(sql`SET LOCAL hnsw.ef_search = ${efSearch}`);

    return fn(tx as unknown as Database);
  });
}
