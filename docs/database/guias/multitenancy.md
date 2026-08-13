# 🏢 Multitenancy — Isolamento por `organization_id`

> **← [Voltar ao Database](../README.md)**

---

## Regra Fundamental

> Toda query ao banco de dados **deve** incluir filtro por `organization_id`. Sem exceção.

Vazamento de dados entre tenants é classificado como **falha crítica de segurança (P0)**. Isso é ainda mais grave em tabelas biométricas, onde os dados são protegidos pelo regime especial da LGPD Art. 11.

---

## Camadas de Proteção

O isolamento de tenant é garantido por **três camadas independentes**:

| Camada | Mecanismo | Onde Fica |
|--------|-----------|-----------|
| 1. Aplicação | `WHERE organization_id = $orgId` em toda query | `adapters/repositories/` |
| 2. Banco (RLS) | `set_config('app.current_org_id', ...)` + políticas RLS | PostgreSQL — ver [arquitetura/rls.md](../arquitetura/rls.md) |
| 3. Auth | `currentOrg` injetado via `derive` do Better Auth | `infrastructure/auth.ts` |

---

## Versões Mínimas Requeridas

| Componente | Versão mínima | Observação |
|------------|---------------|------------|
| PostgreSQL | 16.x | HNSW index disponível |
| pgvector | 0.8.x (pinado em `0.8.6-pg16`) | HNSW, `halfvec` e `iterative_scan` (exigido pelos experimentos da IC — ver ADR-002) |
| Redis | 7.x | Filas para o AI Service |

---

## Extensões PostgreSQL Necessárias

| Extensão | Finalidade |
|----------|------------|
| `uuid-ossp` | `uuid_generate_v4()` |
| `pgvector` | Tipo `vector(N)` e operadores `<=>`, `<->` |
| `pg_trgm` | Busca textual por similaridade (nomes, matrículas) |
| `btree_gin` | Índices GIN compostos em JSONB |

---

## Checklist de Revisão de Query

Antes de submeter qualquer query nova, verificar:

- [ ] A query filtra por `organization_id`?
- [ ] O `organization_id` vem do contexto autenticado (não de input do usuário não validado)?
- [ ] Se for INSERT, o `organization_id` é propagado para a nova linha?
- [ ] Joins com outras tabelas também filtram por `organization_id` na tabela joinada?
