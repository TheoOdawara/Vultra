# PostgreSQL

Imagem `pgvector/pgvector:0.8.6-pg16-bookworm` · já está no compose, servindo o backend anterior.

## O que faz

Guarda todo o estado durável: usuários, pessoas, câmeras, vetores, eventos de reconhecimento e trilha de
auditoria. Faz a comparação 1:N do vetor de uma captura contra a galeria da instituição, com pgvector.

## O que nunca faz

- Guardar quadro ([BR-01](../../requirements/business-rules.md#br-01)).
- Devolver linha de outra instituição: o isolamento é imposto por RLS, além do filtro da aplicação
  ([NFR-SEC-01](../../requirements/non-functional/security.md#nfr-sec-01)).

## Para mudar com segurança

- A versão do pgvector é fixada por tag exata para a reprodutibilidade do experimento do artigo
  ([ADR-002 de banco](../../database/adrs/ADR-002-pin-pgvector-0.8.md)).
- O índice é HNSW ([ADR-001 de banco](../../database/adrs/ADR-001-pgvector-hnsw.md)). A topologia do
  índice sob RLS é a variável do experimento em [../../research/pre-registro.md](../../research/pre-registro.md).
- Há dois papéis de banco: o do Serviço, sem `BYPASSRLS` e sem ser dono das tabelas, e o das
  migrations ([tenancy](../concepts/tenancy.md)).
- O esquema do backend novo ainda não existe; as primeiras tabelas são do épico #176. Ver [../../data-model/](../../data-model/README.md).
