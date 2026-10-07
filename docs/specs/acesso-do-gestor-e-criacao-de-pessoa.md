# SPEC-004 — Autenticar gestor e criar pessoa

> **Status:** publicada
> **Perfil:** API
> **Módulo:** `apps/api`, módulos `access` e `registry`
> **Epic:** #176
> **Requisitos:** FR-ACC-01, FR-REG-01, NFR-SEC-01, NFR-SEC-04, NFR-SEC-06
> **Sprint:** 1 (spec e sub-issues); o código abre o Sprint 2

Primeiro épico com código da reescrita. Ele cria `apps/api`, o banco com isolamento por instituição e as
duas operações que todo o resto do E1 pressupõe: um gestor autenticado e uma pessoa a quem um cadastro
biométrico possa se vincular.

## Premissas confirmadas

Confirmadas por Theo em 2026-10-06.

1. A sessão é um token Bearer guardado no PostgreSQL (estratégia Database do `fastapi-users`), não JWT.
2. Instituição e primeiro gestor nascem por um comando de terminal. Não há rota de registro, convite,
   verificação de e-mail nem recuperação de senha.
3. Pessoa só é criada. Listar, ler, editar e apagar ficam fora, e criar pessoa não gera registro de
   auditoria.
4. Cada rota declara os papéis que a acessam. Não existe nome de permissão entre o papel e a rota.
5. `person` fica sob RLS. `user` e `accesstoken` ficam fora, porque o login procura o usuário antes de
   existir contexto de instituição; por isso o e-mail é único no sistema inteiro.
6. O login tem cota em Redis por IP e por e-mail e nega quando o Redis está indisponível.
7. O épico cria a fundação inteira de `apps/api`, em quatro entregas.

## Valores confirmados

Confirmados por Theo em 2026-10-06.

| Valor | Decisão |
| --- | --- |
| Tamanho de `external_id` | 1 a 64 caracteres |
| Tamanho de `name` | 1 a 200 caracteres |
| Validade do token de sessão | 8 horas |
| Cota do login por e-mail | 5 tentativas a cada 15 minutos |
| Cota do login por IP | 20 tentativas a cada 15 minutos |
| Senha do gestor | 12 a 128 caracteres, sem regra de composição |

---

## Acceptance Criteria

### Contrato

| Método | Rota | Auth / Role | Idempotente |
| --- | --- | --- | --- |
| `GET` | `/health` | pública | Sim |
| `POST` | `/v1/auth/login` | pública | Não |
| `POST` | `/v1/auth/logout` | `manager` | Sim |
| `POST` | `/v1/people` | `manager` | Não |

O documento OpenAPI e a interface dele são servidos apenas quando `API_DOCS_ENABLED` é `true`.

### Request

**`POST /v1/auth/login`** — `application/x-www-form-urlencoded`, o formato do `fastapi-users`.

| Campo | Tipo | Obrigatório | Validação |
| --- | --- | --- | --- |
| `username` | `string` | Sim | O e-mail do gestor |
| `password` | `string` | Sim | — |

**`POST /v1/auth/logout`** — sem corpo. Cabeçalho `Authorization: Bearer <token>`.

**`POST /v1/people`** — `application/json`. Cabeçalho `Authorization: Bearer <token>`.

| Campo | Tipo | Obrigatório | Validação |
| --- | --- | --- | --- |
| `external_id` | `string` | Sim | O identificador que a instituição já usa para a pessoa, como a matrícula. 1 a 64 caracteres depois de removidos os espaços das pontas. Único na instituição, diferenciando maiúsculas de minúsculas |
| `name` | `string` | Sim | 1 a 200 caracteres depois de removidos os espaços das pontas |

```json
{ "external_id": "2026001234", "name": "Pessoa de Exemplo" }
```

Nenhum pedido carrega a instituição. Ela vem da sessão.

### Response

**`GET /health` — `200 OK`**

```json
{ "status": "ok" }
```

**`POST /v1/auth/login` — `200 OK`**

```json
{ "access_token": "<token>", "token_type": "bearer" }
```

**`POST /v1/auth/logout` — `204 No Content`**

**`POST /v1/people` — `201 Created`**

```json
{
  "id": "6f1c2c0e-6f0b-4a53-9a57-0d2f6f0f3b1a",
  "external_id": "2026001234",
  "name": "Pessoa de Exemplo",
  "created_at": "2026-10-12T14:03:22Z"
}
```

| Status | Quando |
| --- | --- |
| `200` | Login com credencial válida; verificação de saúde |
| `201` | Pessoa criada |
| `204` | Logout de uma sessão válida |
| `400` | Login com credencial inválida |
| `401` | Rota protegida sem token, ou com token inexistente, expirado ou já encerrado |
| `403` | Usuário autenticado cujo papel não está entre os declarados pela rota |
| `404` | Rota registrada sem declaração de acesso |
| `409` | `external_id` já usado na instituição |
| `422` | Corpo fora da validação |
| `429` | Cota do login excedida |
| `503` | Login com o Redis indisponível |

### Perfis e privilégios

| Papel | Permissão | Observação |
| --- | --- | --- |
| `manager` | `POST /v1/auth/logout`, `POST /v1/people` | Só na própria instituição |
| `teacher` | nenhuma rota neste épico | O valor existe no modelo; nenhum professor é criado antes do E2 |
| sem autenticação | `GET /health`, `POST /v1/auth/login` | As duas declaram que são públicas |

---

## Regras de Negócio

### 1. Autorização

- Toda rota declara, no registro, os papéis que a acessam ou que é pública. A declaração é a única
  fonte da checagem; nenhuma rota confere papel por conta própria.
- Na inicialização, uma rota sem declaração é retirada da aplicação e o serviço grava um log de erro
  `route_without_access_declaration` com o método e o caminho. A requisição a ela responde `404`.
- Em rota protegida, a ordem é: autenticar pelo token, depois conferir o papel. Sem token válido, a
  resposta é `401` com `"Unauthorized"`. Com papel fora da declaração, é `403` com `"Forbidden"`.
- O token é inválido quando não existe, quando foi encerrado por logout ou quando tem mais de 8 horas.

### 2. Autenticação do gestor

- O login confere e-mail e senha pelo `fastapi-users`. E-mail inexistente, senha errada e usuário
  inativo recebem a mesma resposta: `400` com `"LOGIN_BAD_CREDENTIALS"`.
- O logout apaga o token do banco. O mesmo token, usado depois, recebe `401`.
- Senha e token nunca aparecem em log, em mensagem de erro nem em resposta que não seja a do login.

### 3. Cota do login

- A cota é contada no Redis antes de a credencial ser conferida, em duas chaves: o e-mail informado e o
  IP da conexão. Conta toda tentativa, com ou sem sucesso.
- Limites: 5 tentativas a cada 15 minutos por e-mail e 20 a cada 15 minutos por IP. Vale o primeiro
  limite excedido.
- Acima do limite, a resposta é `429` com `"LOGIN_RATE_LIMITED"` e o cabeçalho `Retry-After` em
  segundos.
- Com o Redis indisponível, a resposta é `503` com `"RATE_LIMIT_UNAVAILABLE"` e a credencial não é
  conferida.
- Nenhum estado de cota vive na memória do processo.

### 4. Isolamento por instituição

- A instituição de uma requisição é a do usuário da sessão. Nenhum campo do cliente a define.
- A tabela `person` tem `ENABLE ROW LEVEL SECURITY` e `FORCE ROW LEVEL SECURITY`. A política compara
  `institution_id` com `NULLIF(current_setting('app.current_institution_id', TRUE), '')::uuid`, em
  leitura e em escrita. Sem contexto, a comparação é nula e nenhuma linha passa.
- O serviço conecta com um papel de banco que não é dono das tabelas e não tem `BYPASSRLS`. As
  migrations rodam com outro papel.
- `app.current_institution_id` é definido com `SET LOCAL`, na mesma transação da consulta, em um único
  ponto do serviço. Nenhum outro código o define.
- O filtro por instituição na consulta da aplicação continua obrigatório; o RLS é a segunda barreira.

### 5. Criação de pessoa

- O gestor cria uma pessoa com `external_id` e `name`. Ela nasce na instituição dele.
- `external_id` é único dentro da instituição. Repetido, a criação é recusada com `409` e
  `"PERSON_EXTERNAL_ID_ALREADY_EXISTS"`. O mesmo `external_id` em outra instituição é aceito.
- De uma pessoa o sistema guarda apenas `external_id` e `name` como dado cadastral
  ([BR-06](../requirements/business-rules.md#br-06)).

### 6. Ambiente

- Um único módulo lê o ambiente. Toda variável é obrigatória e validada na inicialização, sem valor
  padrão.
- Com uma variável ausente ou fora do formato, o processo encerra com erro que traz o nome da variável
  e o formato esperado. Isso vale para o serviço, para o comando `create-manager` e para as migrations.

| Variável | Formato |
| --- | --- |
| `DATABASE_URL` | `postgresql+psycopg://<usuário>:<senha>@<host>:<porta>/<banco>`, com o papel do serviço |
| `MIGRATION_DATABASE_URL` | O mesmo formato, com o papel dono das tabelas |
| `REDIS_URL` | `redis://<host>:<porta>/<índice>` |
| `API_DOCS_ENABLED` | `true` ou `false` |

### 7. Criação de instituição e gestor

- O comando `create-manager`, executado com `uv run` em `apps/api`, cria uma instituição e o primeiro
  gestor dela, na mesma transação.
- Argumentos: `--institution-name` (1 a 200 caracteres) e `--email`. A senha é pedida no terminal, sem
  eco, e nunca é argumento.
- A senha tem de 12 a 128 caracteres. Fora disso o comando encerra com
  `"password must have between 12 and 128 characters"` e nada é gravado.
- Com um e-mail já existente, o comando encerra com `"email already registered"` e nada é gravado.
- Em sucesso, imprime `"manager created: <email> (institution <id>)"`.

### 8. Persistência e Auditoria

- **Tabelas/colunas alteradas:** `institution`, `user`, `accesstoken` e `person` são criadas; o detalhe
  está em Impacto no modelo de dados.
- **Auditoria:** N/A — o registro de auditoria cobre operação sobre dado biométrico
  ([FR-GOV-01](../requirements/functional/governance.md#fr-gov-01)) e nasce no épico #175.
- **Eventos/integrações disparados:** N/A — nada é emitido.

---

## Erros

O corpo de erro é `{"detail": "<código>"}`. O `422` usa o formato de validação do FastAPI.

| Código | HTTP | Quando | Mensagem |
| --- | --- | --- | --- |
| `LOGIN_BAD_CREDENTIALS` | `400` | E-mail inexistente, senha errada ou usuário inativo | "LOGIN_BAD_CREDENTIALS" |
| `Unauthorized` | `401` | Rota protegida sem token válido | "Unauthorized" |
| `Forbidden` | `403` | Papel do usuário fora da declaração da rota | "Forbidden" |
| `Not Found` | `404` | Rota retirada por não declarar acesso | "Not Found" |
| `PERSON_EXTERNAL_ID_ALREADY_EXISTS` | `409` | `external_id` já usado na instituição | "PERSON_EXTERNAL_ID_ALREADY_EXISTS" |
| validação | `422` | Campo ausente, vazio ou acima do tamanho | a lista de erros de validação do FastAPI |
| `LOGIN_RATE_LIMITED` | `429` | Cota do login excedida | "LOGIN_RATE_LIMITED" |
| `RATE_LIMIT_UNAVAILABLE` | `503` | Login com o Redis indisponível | "RATE_LIMIT_UNAVAILABLE" |

## Efeitos Colaterais

- **Persistência:** o login grava uma linha em `accesstoken`; o logout a apaga; `POST /v1/people` grava
  uma linha em `person`.
- **Concorrência:** duas criações simultâneas com o mesmo `external_id` na mesma instituição são
  decididas pela restrição de unicidade do banco: uma recebe `201`, a outra `409`.
- **Transação:** a definição de `app.current_institution_id` e a escrita em `person` acontecem na mesma
  transação. O comando `create-manager` grava instituição e usuário juntos ou nenhum dos dois.

---

## Cenários de Aceite (Gherkin)

Onde o guard é uma política do banco, o cenário roda contra um PostgreSQL de verdade. Todo cenário de
negação precisa falhar quando o guard correspondente é removido.

### Cenário 1 — Gestor autentica e cria pessoa (caminho feliz)

```gherkin
Dado que existe um gestor da instituição A com credencial válida
Quando envia `POST /v1/auth/login` com o e-mail e a senha
Então o sistema responde `200` com `access_token` e `token_type` igual a "bearer"
Quando envia `POST /v1/people` com esse token, `external_id` "2026001234" e `name` "Pessoa de Exemplo"
Então o sistema responde `201` com `id`, `external_id`, `name` e `created_at`
E persiste a pessoa em `person` com o `institution_id` da instituição A
```

### Cenário 2 — Credencial inválida não revela se o usuário existe (exceção)

```gherkin
Dado que existe um gestor com o e-mail "gestor@exemplo.test"
Quando envia `POST /v1/auth/login` com esse e-mail e a senha errada
E envia `POST /v1/auth/login` com um e-mail que não existe
Então as duas respostas são `400` com o corpo `{"detail": "LOGIN_BAD_CREDENTIALS"}`
```

### Cenário 3 — Rota protegida sem autenticação (autorização negada)

```gherkin
Dado que nenhuma credencial é enviada
Quando envia `POST /v1/people` com um corpo válido
Então o sistema responde `401` com "Unauthorized"
E nenhuma linha é gravada em `person`
E a única rota de dado ou de saúde que responde sem autenticação é `GET /health`
```

### Cenário 4 — Papel fora da declaração da rota (autorização negada)

```gherkin
Dado um usuário autenticado com o papel `teacher`
Quando envia `POST /v1/people` com um corpo válido
Então o sistema responde `403` com "Forbidden"
E nenhuma linha é gravada em `person`
```

### Cenário 5 — Rota sem declaração de acesso não é servida (exceção)

```gherkin
Dado uma rota registrada sem declarar papéis nem que é pública
Quando o serviço inicia
Então grava o log de erro `route_without_access_declaration` com o método e o caminho
E uma requisição a essa rota responde `404`
```

### Cenário 6 — Token encerrado por logout (caminho alternativo)

```gherkin
Dado um gestor com uma sessão válida
Quando envia `POST /v1/auth/logout`
Então o sistema responde `204`
Quando envia `POST /v1/people` com o mesmo token
Então o sistema responde `401` com "Unauthorized"
```

### Cenário 7 — Token com mais de 8 horas (exceção)

```gherkin
Dado um token de sessão criado há mais de 8 horas
Quando envia `POST /v1/people` com esse token
Então o sistema responde `401` com "Unauthorized"
```

### Cenário 8 — Identificador externo repetido na instituição (exceção)

```gherkin
Dado que a instituição A já tem uma pessoa com `external_id` "2026001234"
Quando o gestor da instituição A envia `POST /v1/people` com `external_id` "2026001234"
Então o sistema responde `409` com "PERSON_EXTERNAL_ID_ALREADY_EXISTS"
E a instituição A continua com uma única pessoa com esse `external_id`
```

### Cenário 9 — Mesmo identificador externo em outra instituição (caminho alternativo)

```gherkin
Dado que a instituição A já tem uma pessoa com `external_id` "2026001234"
Quando o gestor da instituição B envia `POST /v1/people` com `external_id` "2026001234"
Então o sistema responde `201`
E a pessoa criada pertence à instituição B
```

### Cenário 10 — Corpo fora da validação (exceção)

```gherkin
Dado um gestor autenticado
Quando envia `POST /v1/people` com `name` vazio, ou com `external_id` de 65 caracteres
Então o sistema responde `422`
E nenhuma linha é gravada em `person`
```

### Cenário 11 — Consulta sem o filtro da aplicação (exceção)

```gherkin
Dado que as instituições A e B têm pessoas gravadas
Quando uma consulta a `person` sem filtro por instituição roda com `app.current_institution_id` de A
Então ela devolve 0 linhas da instituição B
E uma escrita em `person` com o `institution_id` de B é recusada pelo banco
```

### Cenário 12 — Consulta sem contexto de instituição (exceção)

```gherkin
Dado que as instituições A e B têm pessoas gravadas
Quando uma consulta a `person` roda sem `app.current_institution_id` definido
Então ela devolve 0 linhas
```

### Cenário 13 — Cota do login excedida (exceção)

```gherkin
Dado 5 tentativas de login com o mesmo e-mail nos últimos 15 minutos
Quando chega a sexta tentativa, com a senha correta
Então o sistema responde `429` com "LOGIN_RATE_LIMITED" e o cabeçalho `Retry-After`
E a credencial não é conferida
```

### Cenário 14 — Redis indisponível no login (exceção)

```gherkin
Dado o Redis indisponível
Quando envia `POST /v1/auth/login` com credencial válida
Então o sistema responde `503` com "RATE_LIMIT_UNAVAILABLE"
E nenhum token é criado
```

### Cenário 15 — Variável de ambiente ausente (exceção)

```gherkin
Dado o ambiente sem a variável `DATABASE_URL`
Quando o serviço, o comando `create-manager` ou as migrations iniciam
Então o processo encerra com erro que contém "DATABASE_URL" e o formato esperado
E nenhuma variável tem valor padrão no módulo de ambiente
```

### Cenário 16 — Criar instituição e gestor pelo comando (caminho feliz)

```gherkin
Dado um banco sem a instituição "Instituição de Exemplo"
Quando executa `create-manager` com `--institution-name` e `--email` e informa uma senha de 12 caracteres
Então o comando imprime "manager created: <email> (institution <id>)"
E o gestor consegue autenticar em `POST /v1/auth/login`
Quando executa de novo com o mesmo e-mail
Então o comando encerra com "email already registered" e nenhuma instituição nova é gravada
```

### Cenário 17 — Senha fora do tamanho no comando (exceção)

```gherkin
Dado um banco sem o e-mail "gestor@exemplo.test"
Quando executa `create-manager` e informa uma senha de 11 caracteres
Então o comando encerra com "password must have between 12 and 128 characters"
E nenhuma instituição e nenhum usuário são gravados
```

---

## Impacto na arquitetura

- **Serviço** ([building-blocks/service.md](../architecture/building-blocks/service.md)): passa a
  existir, com os módulos `access` (login, logout, declaração de acesso por papel, cota do login) e
  `registry` (criação de pessoa).
- **PostgreSQL** ([building-blocks/postgres.md](../architecture/building-blocks/postgres.md)): ganha o
  primeiro esquema do backend novo e dois papéis de banco, o do serviço e o das migrations.
- **Redis** ([building-blocks/redis.md](../architecture/building-blocks/redis.md)): passa a guardar a
  cota do login, antes da cota de captura do épico #178.
- **Segurança** ([concepts/security.md](../architecture/concepts/security.md)): a linha "toda rota
  declara a permissão que exige" passa a dizer que a rota declara os papéis; entra a cota do login.
- **Isolamento por instituição** ([concepts/tenancy.md](../architecture/concepts/tenancy.md)): registra
  o mecanismo, `SET LOCAL app.current_institution_id` em um único ponto, e que `user` e `accesstoken`
  ficam fora do RLS.
- **Implantação** ([deployment.md](../architecture/deployment.md)): o compose é reescrito com
  PostgreSQL, Redis e o Serviço. O Proxy TLS entra no épico #178.

## Impacto no modelo de dados

As quatro tabelas entram no diagrama do modelo lógico em `docs/data-model/README.md`.

| Tabela | Colunas | Restrições |
| --- | --- | --- |
| `institution` | `id` uuid, `name` varchar(200), `created_at` timestamptz | chave primária em `id` |
| `user` | as do `fastapi-users` (`id` uuid, `email`, `hashed_password`, `is_active`, `is_superuser`, `is_verified`), mais `institution_id` uuid e `role` (`manager`, `teacher`) | `email` único no sistema; `institution_id` obrigatório, referencia `institution` |
| `accesstoken` | as do `fastapi-users` (`token`, `created_at`, `user_id`) | `user_id` referencia `user` |
| `person` | `id` uuid, `institution_id` uuid, `external_id` varchar(64), `name` varchar(200), `created_at` timestamptz | único em (`institution_id`, `external_id`); RLS habilitado e forçado |

`is_superuser` e `is_verified` vêm da biblioteca, ficam sempre `false` e nenhuma regra os lê.

## Fora de Escopo

- Listar, ler, editar e apagar pessoa: nenhum requisito do E1 pede; entram com a spec que precisar.
- Importar pessoas em lote: FR-REG-02, E2.
- Registro, convite, verificação de e-mail e recuperação de senha: o sistema não envia e-mail no E1.
- Segundo gestor em uma instituição que já existe: o comando cria uma instituição nova a cada execução.
- Autenticação e escopo do professor: FR-ACC-02 e FR-ACC-03, E2.
- Registro de auditoria: FR-GOV-01, épico #175.
- Proxy TLS e o IP real do cliente atrás dele: épico #178. Até lá a chave de IP da cota é o endereço da
  conexão.
- Cota das rotas de captura: NFR-SEC-03, épico #178.
- CI: os gates rodam na máquina de quem desenvolve.
- A varredura de segredo em log de NFR-SEC-05: épico #179.

## Quebra em Tasks

| # | Issue | Título | Escopo | Critério de aceite | Depende de |
| --- | --- | --- | --- | --- | --- |
| 1 | #186 | Criar o serviço da API com ambiente obrigatório e rotas negadas por padrão | `apps/api`: projeto `uv` com dependências fixadas, módulo de ambiente, `GET /health`, registro de rotas que retira a rota sem declaração, OpenAPI sob `API_DOCS_ENABLED`, gates Ruff, mypy e pytest, `apps/api/AGENTS.md` e a tabela de comandos do `AGENTS.md` da raiz | Cenários 5 e 15 | — |
| 2 | #187 | Subir o compose e o primeiro esquema com isolamento por instituição | `infra/docker-compose.yml` com PostgreSQL, Redis e o Serviço; os dois papéis de banco; Alembic e a primeira migration com `institution`, `user`, `accesstoken` e `person` sob RLS; a sessão que define `app.current_institution_id` | Cenários 11 e 12 | 1 |
| 3 | #188 | Autenticar o gestor com rotas declaradas por papel e cota no login | Módulo `access`: login e logout do `fastapi-users` com token no banco, declaração de papéis por rota, cota do login no Redis, comando `create-manager` | Cenários 2, 3, 4, 6, 7, 13, 14, 16 e 17 | 2 |
| 4 | #189 | Criar pessoa na instituição do gestor | Módulo `registry`: `POST /v1/people` com unicidade de `external_id` por instituição | Cenários 1, 8, 9 e 10 | 3 |
