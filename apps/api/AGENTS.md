# apps/api

O Serviço: o único backend do Vultra. Soma-se ao `AGENTS.md` da raiz e não o contradiz.

## Estado real

Existem a fundação (a configuração de ambiente, `GET /health` e o OpenAPI sob `API_DOCS_ENABLED`), o
primeiro esquema (`institution`, `user`, `accesstoken` e `person`, esta sob RLS) e o módulo `access`:
`POST /v1/auth/login`, `POST /v1/auth/logout`, a declaração de papel por rota, a cota do login e o comando
`create-manager`. O módulo `registry` tem `POST /v1/people`, a primeira rota sobre `institution_session`.
Nenhuma outra capacidade tem rota.

## Stack

Projeto `uv` independente, com `pyproject.toml` e `uv.lock` próprios; não há workspace na raiz. O código
fica em `app/`, sem `src/`, e é empacotado com o `uv_build` só para o `uv sync` instalar o executável
`create-manager`. Python 3.13, que o
`uv` instala sozinho no primeiro `uv sync`. As versões vêm da tabela do ADR 0005, e uma biblioteca dela só
entra no `pyproject.toml` na entrega que a usa.

## Comandos

Todos executados dentro de `apps/api`. No VS Code, as tarefas `api: serve` e `api: gates` fazem o mesmo.

```
uv sync
uv run ruff check
uv run ruff format --check
uv run mypy
uv run pytest
uv run fastapi dev
uv run create-manager --institution-name "<nome>" --email <e-mail>
```

Para desenvolver, o PostgreSQL e o Redis sobem com `docker compose -f compose.dev.yaml up -d` em
`infra`, em `127.0.0.1:5432` e `127.0.0.1:6379`, e as migrations rodam daqui com `uv run alembic upgrade head`.

O `fastapi dev` é o CLI do FastAPI em modo de desenvolvimento, com recarga ao salvar; `fastapi run` é o modo
de produção. No Windows só o `fastapi dev` serve: o `psycopg` assíncrono não aceita o laço de eventos que o
`fastapi run` usa ali. O `create-manager` cria uma instituição e o primeiro gestor dela, pede a senha no
terminal e recusa e-mail de domínio reservado, como `.test`. Os dois acham a aplicação pelo `entrypoint` de `[tool.fastapi]` no `pyproject.toml`. O `.env` é
uma cópia preenchida de `.env.example` e não é versionado. O `pytest` trata todo aviso como erro. O `mypy`
roda em modo `strict` sobre `app` e `tests`, com o plugin do Pydantic.

## Arquitetura

```
app/main.py            o ponto de entrada: cria o `app` global que o CLI do FastAPI serve
app/application.py     `create_app`: monta a aplicação a partir de um `Settings` e cria o storage da cota
app/core/settings.py   a configuração lida do ambiente
app/core/database.py   a base dos modelos, o engine, a sessão simples e `institution_session`, que define a instituição da transação
app/features/access/   `router.py` (login e logout), `authentication.py` (a ligação com o `fastapi-users`, `require_roles`
                       e `user_institution_session`), `login_quota.py`, `create_manager.py` e `models.py`
app/features/registry/ `router.py` (`POST /v1/people`), `schemas.py` e `models.py`: a tabela `person`
migrations/            as migrations do Alembic, aplicadas com `MIGRATION_DATABASE_URL`; os privilégios vão para o usuário da `DATABASE_URL`
tests/                 os testes, fora do pacote
```

**`core/`** guarda a infraestrutura, que tem ciclo de vida próprio e não pertence a nenhuma capacidade:
ambiente e sessão de banco; log quando chegar.

**`features/`** nasce com a primeira capacidade e guarda uma pasta por capacidade do SRS. Dentro dela, cada
responsabilidade é um arquivo, e o arquivo só nasce quando tem conteúdo:

| Arquivo | Responsabilidade |
| --- | --- |
| `router.py` | as rotas: contrato HTTP e a autenticação que exigem |
| `service.py` | as regras da capacidade |
| `queries.py` | as consultas: funções que recebem a `Session` e executam o SQL |
| `schemas.py` | entrada e saída da API, em Pydantic |
| `models.py` | as tabelas, em SQLAlchemy |

O `queries.py` guarda funções, não uma classe de repositório em volta da sessão: a `Session` do SQLAlchemy
já é a unidade de trabalho. Uma responsabilidade vira pasta só quando uma feature tiver mais de um arquivo
dela.

A tabela é o ponto de partida de uma capacidade com regra e consulta próprias, não uma forma a preencher.
Um módulo que é quase todo ligação com uma biblioteca nomeia os arquivos pelo que eles guardam: em `access`
quem consulta `user` e `accesstoken` é o `fastapi-users`, então não há `service.py` nem `queries.py`, e a
ligação inteira fica em `authentication.py`, na ordem em que a documentação da biblioteca a apresenta. Um `common/` só nasce quando duas features usarem a mesma coisa.

**Paradigma.** Funções e dados. Classe só quando o framework exige: `Settings`, esquema do Pydantic, modelo
do SQLAlchemy. A estrutura segue o Python, o FastAPI e as bibliotecas em uso, nunca o padrão de outra
stack.

- **Ambiente.** `Settings` é uma classe do `pydantic-settings` com um campo tipado por variável, sem valor
  padrão e sem validação escrita à mão. Ela lê o `.env` da pasta de execução, e o ambiente do processo vale
  mais que o arquivo; em produção não há `.env`. Variável ausente ou fora do tipo impede a inicialização,
  com o erro do próprio Pydantic, e `hide_input_in_errors` mantém o valor recebido fora dele: a
  `DATABASE_URL` carrega a senha. Os testes rodam em uma pasta vazia, para o `.env` de quem desenvolve não
  mascarar uma variável ausente.
- **Ponto de entrada.** Importar `app.main` exige o ambiente completo; por isso os testes importam
  `create_app` de `app.application` e passam um `Settings` próprio.
- **OpenAPI.** `/docs` e `/openapi.json` são as rotas embutidas do FastAPI, ligadas só com
  `API_DOCS_ENABLED=true`.
- **Autenticação.** O `fastapi-users` confere a credencial e guarda o token no banco, válido por 8 horas. As
  duas rotas de `access/router.py` são nossas e chamam a biblioteca, que é quem executa o SQL de usuário e
  de token; o roteador pronto dela não é usado,
  porque a cota roda antes da credencial e o logout exige papel.
- **Autorização.** A rota protegida declara os papéis em `dependencies=[Depends(require_roles(...))]`, no
  router ou na rota. Sem token válido a resposta é `401`; com papel fora da declaração, `403`. Não há
  varredura de rotas na inicialização.
- **Cota.** `enforce_login_quota` conta no Redis, pelo `limits`, antes de a credencial ser conferida. Redis
  fora do ar ou lento além de 1 segundo nega com `503`. O login e o `create-manager` recusam e-mail com
  caractere fora do ASCII: o PostgreSQL e o Python passam essas letras para minúscula de formas
  diferentes, e uma mesma conta ganharia mais de uma chave de cota.
- **Banco.** O engine nasce em `create_engine` com `hide_parameters=True`, para um erro de SQL não levar
  token nem e-mail ao log.
- **Instituição.** A rota que lê ou grava dado de instituição recebe a sessão por
  `Depends(user_institution_session, scope="function")`: a dependência abre `institution_session` com a
  instituição do usuário autenticado, e o `scope="function"` faz o commit acontecer antes de a resposta
  sair. Em `registry` o insert fica na própria rota, sem `service.py` nem `queries.py`, e a unicidade de
  `external_id` é decidida pela restrição do banco: a rota traduz o `IntegrityError` em `409`.
- **Erros.** Todo erro sai como `HTTPException`, o mecanismo do FastAPI, com o código da spec em `detail`:
  `HTTPException(status.HTTP_400_BAD_REQUEST, "LOGIN_BAD_CREDENTIALS")`. Não há exceção de negócio própria
  nem tratador que a traduza; os dois só nascem quando uma regra for chamada fora de uma rota.

## Testes

Nenhum teste sobe banco nem Redis. O `Service` de `tests/conftest.py` troca, via `dependency_overrides`, os
adaptadores de usuário e de token do `fastapi-users` e a sessão da instituição por versões em memória, e o
storage da cota em `app.state` pelo `MemoryStorage` do `limits`. A rota protegida que os testes de `access`
exercitam é `POST /v1/people`. A sessão em memória recusa `external_id` repetido na instituição com o
mesmo `IntegrityError` do banco; a restrição de verdade e o RLS de `person` são conferidos à mão no
PostgreSQL do compose, o RLS pela emenda de 2026-10-07 ao ADR 0001.

Os testes HTTP usam o `TestClient` do FastAPI sobre o `httpx2`. Com o `httpx` no lugar, o Starlette 1.7
emite um aviso de depreciação, e o gate não aceita aviso.
