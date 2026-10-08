# Serviço

`apps/api` · Python 3.13, FastAPI · estágio E1 · em construção: existem a fundação (ambiente, `GET /health`,
OpenAPI sob `API_DOCS_ENABLED`), o primeiro esquema, o módulo `access` (login e logout do gestor) e, em
`registry`, a criação de pessoa. Os outros módulos da tabela abaixo ainda não têm código.

## O que faz

É o único backend. Serve a API do gestor e do painel, mantém a conexão de cada câmera, entrega o quadro
ao [Pipeline](pipeline.md), compara o vetor com a galeria da instituição e grava o resultado.

## O que nunca faz

- Carregar modelo ou chamar o runtime de inferência: isso é do Pipeline.
- Gravar o quadro em qualquer lugar ([BR-01](../../requirements/business-rules.md#br-01)).
- Ler ou escrever dado de outra instituição ([BR-03](../../requirements/business-rules.md#br-03)).

## Blocos internos

A infraestrutura (ambiente, banco, Redis, log) fica em `app/core/`. Em `app/features/` há um módulo por
capacidade, com os nomes das áreas do SRS, e dentro dele um arquivo por responsabilidade: `router.py`,
`service.py`, `queries.py`, `schemas.py`, `models.py`. Rota, regra e consulta de uma capacidade ficam
juntas no módulo dela.

| Módulo | Responsabilidade | Requisitos | Estágio |
| --- | --- | --- | --- |
| `access` | Autenticação de usuário e escopo por papel | FR-ACC | E1 gestor, E2 professor |
| `registry` | Registro de pessoas | FR-REG | E1 criação, E2 importação |
| `devices` | Câmeras, credenciais e disparo de captura | FR-DEV | E1 |
| `biometrics` | Cadastro biométrico e revogação | FR-BIO | E1 |
| `recognition` | Comparação 1:N e evento de reconhecimento | FR-REC | E1 |
| `affective` | Emoção no evento; agregação e supressão | FR-AFF | E1 guarda, E2 agregação |
| `governance` | Trilha de auditoria | FR-GOV | E1 |

Turma, sessão de chamada, presença e relatório (FR-ATT, FR-RPT) são do E2 e ainda não têm módulo
decidido.

## Para mudar com segurança

- Uma interface só é criada em fronteira externa real. Hoje a única prevista é a chamada ao Pipeline.
- A decisão entre pool de processos e fila para a inferência está aberta até a medição de
  [OQ-03](../../requirements/open-questions.md#oq-03); só o ponto de chamada do Pipeline muda.
- O usuário e a sessão vêm do `fastapi-users`, que mantém o `sqlalchemy` na linha 2.0
  ([0005](../../decisions/0005-backend-unico-em-python.md)).
- Cada rota protegida declara os papéis que a acessam, na dependência do router ou da rota (E1,
  [SPEC-004](../../specs/acesso-do-gestor-e-criacao-de-pessoa.md)).
- A sessão é um token Bearer guardado no PostgreSQL, com 8 horas de validade; o logout o apaga (E1,
  SPEC-004).
- A instituição da requisição é definida no banco em um único ponto, na mesma transação da consulta
  ([tenancy](../concepts/tenancy.md)).
