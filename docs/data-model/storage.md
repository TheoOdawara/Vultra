# Armazenamento

## O que está decidido

- **Banco:** PostgreSQL 16 com pgvector 0.8, imagem `pgvector/pgvector:0.8.6-pg16-bookworm`
  ([ADR-002 de banco](../database/adrs/ADR-002-pin-pgvector-0.8.md)).
- **Vetor:** 512 dimensões, saída do módulo de reconhecimento do `buffalo_l`
  ([0006](../decisions/0006-inferencia-no-processo-do-servico.md)).
- **Índice vetorial:** HNSW ([ADR-001 de banco](../database/adrs/ADR-001-pgvector-hnsw.md)). A
  topologia do índice sob isolamento é a variável do experimento do artigo
  ([pré-registro](../research/pre-registro.md)).
- **Isolamento:** RLS em toda tabela que pertence a uma instituição
  ([tenancy](../architecture/concepts/tenancy.md)).
- **Migrations:** Alembic ([0005](../decisions/0005-backend-unico-em-python.md)).
- **Redis:** guarda só cota e comandos de câmera; nada dele é fonte de verdade.

## O que não existe ainda

As tabelas, chaves e índices do backend novo. Eles são definidos nas specs do E1 e registrados aqui
quando a primeira migration for escrita.

O esquema em `apps/api-core/src/infrastructure/database/schema/` é o do backend anterior, congelado, e
não é a base do novo.
