# Cliente de Banco — `client.ts`

## postgres.js + Drizzle

```typescript
// infrastructure/database/client.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres    from 'postgres';
import { sql }     from 'drizzle-orm';
import * as schema from './schema';

const pg = postgres(process.env['DATABASE_URL']!, {
  max:             20,   // pool máximo
  idle_timeout:    30,   // segundos até fechar conexão ociosa
  connect_timeout: 10,   // segundos timeout de conexão
  prepare:         false, // CRÍTICO — prepared statements quebram RLS set_config
});

export const db = drizzle(pg, { schema });
export type Database = typeof db;
```

---

## `withTenantContext` — Isolamento RLS

**Toda** operação de dados de tenant deve ser envolvida em `withTenantContext`. Ele abre uma transação e chama `set_config('app.current_org_id', orgId, TRUE)` — ativando as políticas RLS para aquele tenant, com escopo de transação (`TRUE` = local à transação, nunca vaza entre requests).

```typescript
export async function withTenantContext<T>(
  organizationId: string,
  fn: (tx: Database) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config('app.current_org_id', ${organizationId}, TRUE)`
    );
    return fn(tx as unknown as Database);
  });
}
```

**As 3 camadas de proteção funcionam juntas:**
1. `WHERE organization_id = $orgId` no código do repositório
2. Política RLS no PostgreSQL (ativada pelo `set_config`)
3. `currentOrg` extraído da sessão autenticada pelo `derive` do Better Auth

---

## `withEfSearch` — Recall HNSW

Para buscas de reconhecimento facial, aumentar o `ef_search` do índice HNSW melhora o recall ao custo de latência ligeiramente maior. Valor padrão do projeto: `80`.

```typescript
export async function withEfSearch<T>(
  db: Database,
  efSearch: number,
  fn: (tx: Database) => Promise<T>,
): Promise<T> {
  return (db as ReturnType<typeof drizzle>).transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL hnsw.ef_search = ${efSearch}`);
    return fn(tx as unknown as Database);
  });
}
```

Sempre usado **dentro** de `withTenantContext`:
```typescript
return withTenantContext(organizationId, (tx) =>
  withEfSearch(tx, 80, async (txEf) => {
    // query vetorial aqui
  })
);
```

---

## Por que `prepare: false` é obrigatório

O `set_config` do PostgreSQL só funciona no escopo de uma transação quando chamado sem prepared statements. Com `prepare: true`, o postgres.js reutiliza prepared statements entre conexões do pool, e `set_config` perde o escopo correto — o que pode vazar dados de tenant entre requests como resultado do planner reutilizar planos com parâmetros incorretos.
