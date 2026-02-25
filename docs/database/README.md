# 🗄️ VULTRA — Database Layer

> **← [Voltar ao Hub Principal](../README.md)**
> **Stack:** PostgreSQL 16 + pgvector 0.7 | **Prioridade:** CRÍTICA | **Última revisão:** Fevereiro 2026

---

## Índice

### 🏛️ Arquitetura

| Documento | Conteúdo |
|-----------|----------|
| [arquitetura/schema.md](./arquitetura/schema.md) | Diagrama ER e descrição de todas as tabelas |
| [arquitetura/versionamento-embeddings.md](./arquitetura/versionamento-embeddings.md) | Risco de migração de modelo e uso da `model_version` |
| [arquitetura/rls.md](./arquitetura/rls.md) | Configuração de Row-Level Security por tenant |

### 📖 Manuais

| Documento | Conteúdo |
|-----------|----------|
| [manuais/migrations.md](./manuais/migrations.md) | Política de migrations append-only e convenções |
| [manuais/indexacao.md](./manuais/indexacao.md) | Estratégia de indexação — HNSW e B-Tree |

### 📌 Guias

| Documento | Conteúdo |
|-----------|----------|
| [guias/multitenancy.md](./guias/multitenancy.md) | Regras de isolamento por `organization_id` |
| [guias/queries-pgvector.md](./guias/queries-pgvector.md) | Padrões de query — coseno, relatórios, agregados |

### 📋 ADRs

| Documento | Decisão |
|-----------|---------|
| [adrs/ADR-001-pgvector-hnsw.md](./adrs/ADR-001-pgvector-hnsw.md) | Escolha do pgvector com índice HNSW |

---

## Regras de Ouro

1. **Multitenancy inviolável** — todo `SELECT/INSERT/UPDATE/DELETE` filtra por `organization_id`.
2. **Sem imagens no banco** — apenas `vector(512)`. Armazenar imagem é falha P0.
3. **Migrations append-only** — nunca altere um arquivo já executado em produção.
4. **RLS obrigatório** em todas as tabelas com dados de tenant.
