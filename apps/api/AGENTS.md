# apps/api

O Serviço: o único backend do Vultra. Soma-se ao `AGENTS.md` da raiz e não o contradiz.

## Estado real

Existe só a fundação: a configuração de ambiente, `GET /health` e o OpenAPI sob `API_DOCS_ENABLED`. Não há
banco, Redis, autenticação nem módulo de capacidade. `DATABASE_URL` e `REDIS_URL` são lidas e nada se
conecta a elas ainda.

## Stack

Projeto `uv` independente, com `pyproject.toml` e `uv.lock` próprios; não há workspace na raiz. É uma
aplicação, não um pacote: o código fica em `app/`, sem `src/` e sem backend de build. Python 3.13, que o
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
```

O `fastapi dev` é o CLI do FastAPI em modo de desenvolvimento, com recarga ao salvar; `fastapi run` é o modo
de produção. Os dois acham a aplicação pelo `entrypoint` de `[tool.fastapi]` no `pyproject.toml`. O `.env` é
uma cópia preenchida de `.env.example` e não é versionado. O `pytest` trata todo aviso como erro. O `mypy`
roda em modo `strict` sobre `app` e `tests`, com o plugin do Pydantic.

## Arquitetura

```
app/main.py            o ponto de entrada: cria o `app` global que o CLI do FastAPI serve
app/application.py     `create_app`: monta a aplicação a partir de um `Settings`
app/core/settings.py   a configuração lida do ambiente
tests/                 os testes, fora do pacote
```

**`core/`** guarda a infraestrutura, que tem ciclo de vida próprio e não pertence a nenhuma capacidade:
ambiente agora; conexão de banco, Redis e log quando chegarem.

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
dela. Um `common/` só nasce quando duas features usarem a mesma coisa.

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
- **Autenticação.** Ainda não existe. Quando chegar, a rota protegida recebe a autenticação pela dependência
  do router, que é o mecanismo do FastAPI; não há varredura de rotas na inicialização.
- **Erros.** Quando a primeira regra de negócio chegar, ela levanta um erro de negócio com código, sem HTTP,
  e um único ponto o traduz na resposta que o cliente recebe.

## Testes

Os testes HTTP usam o `TestClient` do FastAPI sobre o `httpx2`. Com o `httpx` no lugar, o Starlette 1.7
emite um aviso de depreciação, e o gate não aceita aviso.
