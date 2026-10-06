# 0005. Backend único em Python com FastAPI

- Status: accepted
- Date: 2026-10-06
- Substitui: [0003](0003-contrato-e-estrutura-da-api.md), [ADR-001 de backend](../backend/adrs/ADR-001-typebox-sobre-zod.md), [ADR-004 de backend](../backend/adrs/ADR-004-estrutura-pastas-modularizacao.md)
- Requisitos: [SRS 1.0.0](../requirements/README.md)

## Contexto

O backend atual são dois serviços em duas linguagens: `api-core` em TypeScript e `ai-service` em Python,
ligados por um contrato de fila declarado duas vezes, uma em cada linguagem. As escolhas vieram de gosto
e de padrão, não de requisito: o `api-core` tem 7 ports com exatamente 1 implementação cada e 27 arquivos
de use-case somando 1.340 linhas. A reescrita é dada; o custo de troca do código existente é zero.

Três forças decidem:

- **O harness do artigo é Python e precisa importar o mesmo pipeline que o produto roda.** Senão o
  artigo mede outra coisa. A inferência é Python em qualquer opção.
- **O time são duas pessoas com prazo em dezembro de 2026.** Cada linguagem a mais é um conjunto de
  gates, um lockfile e um contrato a manter.
- **Segurança e desempenho não são adiados.** Autenticação não é escrita à mão quando existe biblioteca
  mantida.

## Decisão

**Um único serviço de backend, em Python, com FastAPI.** Ele serve a API, mantém a conexão com as
câmeras, roda o pipeline de inferência ([0006](0006-inferencia-no-processo-do-servico.md)) e fala com o
banco. `apps/api-core` e `apps/ai-service` deixam de existir como serviços separados.

**Ferramental.** `uv` para ambiente, dependências e lockfile. Python 3.13. `ruff` e `mypy` como gates.

**Estrutura.** Módulos por capacidade, com os nomes das áreas do SRS: `registry`, `devices`,
`biometrics`, `recognition`, `affective`, `access`, `governance`. Rota, regra e consulta de uma capacidade
ficam juntas no módulo dela. Uma interface só existe em fronteira externa real. O pipeline de inferência
é um pacote à parte, sem dependência do FastAPI nem do banco, para o harness importá-lo sozinho.

**Banco.** PostgreSQL com pgvector e isolamento por RLS, como já está; é o objeto da seção experimental
do artigo. Acesso por SQLAlchemy, migrations por Alembic.

**Bibliotecas**, com a versão estável do PyPI em 2026-10-06, todas fixadas com versão exata. O conjunto
resolve junto em Python 3.13.

| Função | Biblioteca | Versão |
| --- | --- | --- |
| Servidor e API | `fastapi`, `uvicorn` | 0.142.2, 0.54.0 |
| Validação e ambiente | `pydantic`, `pydantic-settings` | 2.13.5, 2.15.0 |
| Banco | `sqlalchemy`, `psycopg`, `alembic`, `pgvector` | 2.0.54, 3.3.6, 1.20.0, 0.5.0 |
| Usuários e sessão | `fastapi-users`, `fastapi-users-db-sqlalchemy` | 15.0.5, 7.0.0 |
| Cota | `limits` sobre `redis` | 5.8.0, 8.1.0 |
| Log e correlação | `structlog`, `asgi-correlation-id` | 26.1.0, 5.0.1 |
| Inferência | `insightface`, `onnxruntime`, `opencv-python-headless`, `numpy` | 2.1, 1.30.0, 5.0.0.93, 2.5.3 |
| Testes | `pytest`, `anyio`, `httpx`, `testcontainers` | 9.1.1, 4.15.1, 0.28.1, 4.15.0 |
| Gates | `ruff`, `mypy` | 0.16.10, 2.4.0 |

**Implantação.** Um único arquivo de compose sobe tudo — banco, Redis, serviço e proxy TLS — nos dois
ambientes do NFR-FLEX-01. Local e nuvem diferem só na configuração.

**Painel.** Não é tocado no E1. A tecnologia dele é decidida quando o E2 for planejado; até lá o
[0004](0004-topologia-e-fundacao-do-portal.md) fica como está, sem servir de base para trabalho novo.

## Consequências

- Uma linguagem, um lockfile, um conjunto de gates, um serviço a implantar. O contrato duplicado entre
  TypeScript e Python desaparece.
- O harness do artigo importa o pacote do pipeline e mede exatamente o código de produção.
- **`sqlalchemy` fica em 2.0.54, não na 2.1.3.** O adaptador oficial do `fastapi-users` exige
  `sqlalchemy<2.1.0` e não é publicado desde janeiro de 2025. É o único desvio da regra de última versão
  estável, aceito para não escrever o adaptador de usuários à mão.
- **`fastapi-users` está em modo manutenção.** Recebe correção de segurança e de dependência, sem
  funcionalidade nova, e tem sucessor anunciado. Aceito por Theo em 2026-10-06; herda-se uma migração
  futura.
- **`pwdlib` não é fixado por nós.** O `fastapi-users` 15.0.5 o fixa em 0.3.0.
- **`insightface` 2.1 declara `opencv-python`**, a variante com interface gráfica, que se instala ao lado
  da `headless`. A dependência é sobrescrita no `uv` para ficar só a `headless`.
- **`insightface` 2.1 emite um `FutureWarning` do `scikit-image` 0.26** a cada alinhamento de rosto. O
  `scikit-image` fica fixado em 0.26.0, e o aviso é filtrado nominalmente no gate de zero aviso.
- O código TypeScript do backend, `packages/types` e o lockfile do Bun saem do repositório. As specs
  SPEC-001 e SPEC-002 descrevem um contrato que deixa de existir e são refeitas a partir do SRS.

## Alternativas consideradas

| Alternativa | Por que foi rejeitada |
| --- | --- |
| TypeScript com Better Auth, mais serviço Python de inferência | Instituição, papéis e convite vêm prontos, mas mantém dois serviços, duas linguagens e o contrato entre elas, que é a fonte de erro já documentada no repositório. |
| Python com Django | Login, sessão, permissões, migrations e admin prontos e auditados. Preterido por Theo em favor do FastAPI, que tem WebSocket nativo para a câmera e já é o framework do `ai-service`. |
| NestJS ou Express no backend | A inferência continua em Python, então voltam as duas linguagens. NestJS acrescenta cerimônia por operação; Express entrega validação e estrutura à mão. |
| Sessão escrita por nós, sem biblioteca de usuários | Mantém o `sqlalchemy` na 2.1.3, mas é código de autenticação próprio. Theo escolheu o `fastapi-users`. |
| `ty` no lugar do `mypy` | Ainda em 0.0.x; não é versão estável. |
