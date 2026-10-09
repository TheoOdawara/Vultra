# Vultra

Sistema de uma Iniciação Científica: presença por reconhecimento facial a partir de uma câmera ESP32-CAM, com o quadro processado apenas em memória e a expressão facial inferida no mesmo quadro. O trabalho acadêmico é o foco, e o sistema é o objeto que o artigo mede.

A verdade de produto vive em `docs/requirements/`, um SRS versionado. As decisões de arquitetura vivem em `docs/decisions/`. Este arquivo não repete nenhum dos dois: ele diz como se trabalha aqui.

---

## Estado real do repositório

Leia isto antes de afirmar que algo está pronto. O sistema está sendo reescrito do zero na branch `develop`, conforme os ADRs 0005 a 0007, e quase nada do que foi decidido existe em código.

- A `develop` contém documentação, o ferramental do repositório, o firmware de bancada em `esp32-cam`, o começo de `apps/api` e o compose em `infra/`. Não há `packages/`.
- `esp32-cam` tem só o firmware de bancada da SPEC-005 e o servidor de bancada: a câmera conecta por `wss://` e envia um quadro a cada 2 s. Não há credencial, comando de captura nem finalidade.
- `apps/api` tem a fundação (ambiente obrigatório, `GET /health`, o OpenAPI sob `API_DOCS_ENABLED`), o primeiro esquema (`institution`, `user`, `accesstoken` e `person`, esta sob RLS) e o módulo `access`: login e logout com token no banco, papel declarado por rota, cota do login no Redis e o comando `create-manager`. O módulo `registry` tem `POST /v1/people`. Nenhuma outra capacidade tem rota.
- `packages/pipeline` não existe. Nenhuma linha dele foi escrita.
- `infra/compose.yaml` sobe PostgreSQL, Redis, as migrations e o Serviço. `infra/compose.dev.yaml` sobe só PostgreSQL e Redis, para o Serviço rodar fora do contêiner. Não há proxy TLS.
- A `main` guarda o sistema anterior: `apps/api-core`, `apps/ai-service`, `packages/types`, `apps/web` e `infra/`. Ninguém a altera, e ela não é base de trabalho novo.
- Os PRs #168 e #172 são trabalho de painel sobre a `main`, do plano anterior. O destino deles é decidido com quem os abriu.
- O ADR 0007 (canal da câmera) está `accepted` pelo teste de bancada da #181. O tempo de reconexão após queda de rede não foi medido e é a issue #193.
- Nenhum workflow de CI existe. Todo gate roda na máquina de quem desenvolve.
- Nenhuma branch tem proteção configurada. A regra de branch abaixo é convenção.
- As specs em `docs/specs/` descrevem o plano anterior ao SRS 1.0.0 e citam IDs `RF-NN` e `RNF-NN` que deixaram de existir. As issues e os milestones desse plano foram fechados em 2026-10-06.
- O hook de início de sessão ainda mede a distância da branch em relação a `origin/main`, não a `origin/develop`.

Um agente que encontrar qualquer um desses itens já resolvido deve confirmar no código antes de acreditar.

---

## Stack

| Camada | Tecnologia | Estado |
|---|---|---|
| Backend | Python 3.13, FastAPI, SQLAlchemy, Alembic, `fastapi-users` | decidido no ADR 0005; existem a fundação de `apps/api` e o primeiro esquema |
| Inferência | InsightFace `buffalo_l`, MiniFASNetV2, FER MobileFaceNet, ONNX Runtime | decidido no ADR 0006, não construído |
| Banco | PostgreSQL 16 + pgvector 0.8 (imagem pinada em `0.8.6-pg16-bookworm`), isolamento por RLS | no compose; `person` sob RLS |
| Cota e canal de comandos | Redis 7 | no compose; guarda a cota do login |
| Firmware | AI-Thinker ESP32-CAM, ESP-IDF 6.1, `esp_websocket_client`, `esp32-camera` | existe o firmware de bancada do ADR 0007 |
| Painel | a definir | não existe na `develop`; tecnologia decidida quando o E2 for planejado |
| Gerenciador Python | `uv` | decidido |
| Lint e tipos | Ruff e mypy no Python | decidido |

As versões exatas das bibliotecas estão na tabela do ADR 0005 e não são repetidas aqui.

---

## Linguagem e scripts

- Backend e pipeline de inferência: Python.
- Firmware: C++.
- Painel: TypeScript.
- Script novo no repositório: Python, executado com `uv run`. Os dois hooks em `.claude/hooks/` são TypeScript executado com Bun e ficam como estão.

---

## Convenções

- Toda dependência entra fixada com versão exata. `sqlalchemy` fica na linha 2.0 por exigência do adaptador do `fastapi-users`; o motivo está no ADR 0005. `redis` fica na linha 7 por exigência do `limits`, no mesmo ADR.
- `insightface` declara `opencv-python`; a dependência é sobrescrita no `uv` para ficar só a `opencv-python-headless`.
- Um único arquivo de compose, `infra/compose.yaml`, sobe o sistema inteiro nos dois ambientes, local e nuvem. A diferença entre eles é só configuração. Ele não publica porta de banco nem de Redis.
- `infra/compose.dev.yaml` existe só para desenvolver: estende o PostgreSQL e o Redis do compose principal e publica as portas deles em `127.0.0.1`. Não é ambiente de implantação.
- O harness de avaliação do artigo importa o pacote do pipeline diretamente e vive em `docs/research/` como artefato de pesquisa, fora da superfície do produto.

---

## Comandos

Só entra aqui comando que foi executado. Cada área com gates próprios tem o seu `AGENTS.md`.

| Área | Gates |
|---|---|
| `apps/api` | `uv run ruff check` · `uv run ruff format --check` · `uv run mypy` · `uv run pytest`; o serviço sobe com `uv run fastapi dev` e o primeiro gestor nasce com `uv run create-manager`. Detalhes em `apps/api/AGENTS.md` |
| `infra` | `docker compose up -d --build` sobe tudo e aplica as migrations antes de o Serviço iniciar; `docker compose -f compose.dev.yaml up -d --remove-orphans` sobe só PostgreSQL e Redis |
| `packages/pipeline` | pendente: a pasta não existe |
| `esp32-cam` | `idf.py build`, com o ESP-IDF v6.1 ativado no terminal. Detalhes em `esp32-cam/AGENTS.md` |
| `apps/web` | pendente: a pasta não existe |

**Documentação**

```
uvx zensical build
uvx zensical serve --open
```

---

## Arquitetura

Decidida nos ADRs 0005, 0006 e 0007. O mapa completo está em `docs/architecture/`.

```
apps/api             serviço FastAPI: API, conexão das câmeras, banco        E1
packages/pipeline    inferência: detecção, qualidade, vivacidade, vetor, emoção   E1
esp32-cam            captura e envio do quadro                               E1
apps/web             painel                                                  E2
infra/               compose único e proxy TLS
docs/research/       pré-registro e harness de avaliação do artigo
```

`apps/api` separa infraestrutura de capacidade: `app/core/` guarda ambiente, banco, Redis e log; `app/features/` guarda um módulo por capacidade, com os nomes das áreas do SRS: `registry`, `devices`, `biometrics`, `recognition`, `affective`, `access`, `governance`. Dentro de um módulo, cada responsabilidade é um arquivo (`router.py`, `service.py`, `queries.py`, `schemas.py`, `models.py`), detalhado em `apps/api/AGENTS.md`.

O paradigma é funções e dados; classe só quando o framework exige. Cada área segue a linguagem, o framework e as bibliotecas dela, nunca o padrão de outra stack.

Regras de fronteira:

- `packages/pipeline` não importa FastAPI, SQLAlchemy, Redis nem nada de `apps/api`. Ele expõe uma única função de entrada, que recebe o quadro e a finalidade e devolve o resultado.
- Nada fora de `packages/pipeline` carrega modelo nem chama o runtime de inferência.
- Rota, regra e consulta de uma capacidade ficam juntas no módulo dela em `apps/api`.
- Uma interface só existe em fronteira externa real. Não se cria interface com uma única implementação.
- O quadro existe apenas em memória. Não é gravado em banco, disco, log, Redis, trilha de auditoria, mensagem de erro nem resposta.
- O isolamento por instituição é imposto no banco por RLS e também filtrado na aplicação.

Onde vai um arquivo novo:

| O que é | Onde |
|---|---|
| Rota, regra ou consulta de uma capacidade | o módulo da capacidade em `apps/api/app/features` |
| Ambiente, conexão de banco ou de Redis, log | `apps/api/app/core` |
| Etapa de inferência ou carga de modelo | `packages/pipeline` |
| Código da câmera | `esp32-cam` |
| Tela | `apps/web` |
| Serviço de infraestrutura | `infra/compose.yaml` |
| Decisão que cruza módulos | `docs/decisions/NNNN-slug.md` |

Fluxo de uma captura:

```
ESP32-CAM  ──WebSocket sobre TLS──▶  proxy  ──▶  apps/api
                                                   │ entrega o quadro ao pool de processos
                                                   ▼
                                           packages/pipeline
                                                   │ vetor, vivacidade, emoção
                                                   ▼
                                  apps/api  ──▶  PostgreSQL + pgvector (comparação 1:N sob RLS)
```

---

## Regras invioláveis

Estão em `docs/decisions/0001-baseline-de-seguranca.md`, que vale para todo o repositório, e nos requisitos `NFR-SEC` e `BR` do SRS. Nenhuma é negociável por prazo. Esse ADR cita mecanismos do backend anterior, como `withTenantContext()`; as regras valem, os nomes dos mecanismos não.

O resumo em uma frase: autorização nega por padrão, nada cruza a fronteira da instituição, a cota vive em Redis e nega quando ele cai, a câmera só fala sobre TLS, ambiente sem valor padrão, nada sensível em log, e nenhuma regra vale sem um teste que falhe quando o guard some. A exceção é o RLS de `person`, conferido à mão no banco, pela emenda de 2026-10-07 ao ADR 0001.

---

## Início de sessão e coordenação

O hook de `SessionStart` em `.claude/settings.json` imprime o brief da sessão: branch e distância de `origin/main`, PRs abertos, issues assignadas e milestones em curso. O plano e a ordem dos épicos estão em `docs/roadmap/`. Ele é o ponto de partida, não um detalhe — sessão que ignora o brief repete trabalho ou colide com o outro integrante.

- Todo trabalho nasce de uma issue do GitHub, e a issue é assignada antes do primeiro commit.
- Antes de escolher trabalho, verifique os PRs abertos e as branches remotas ativas. Trabalho anunciado por outro não é atropelado.
- A base é sempre `origin/develop` atualizada. Branch atrás da `develop` se rebaseia antes de continuar.
- Estado compartilhado vive no GitHub (issues, PRs, milestones, o Project) e nos docs versionados. Memória local de agente não é canal de coordenação, e arquivo de estado fora do repositório não existe para o time.

---

## Branches

A `develop` é a branch de integração da reescrita. A `main` guarda o sistema anterior e fica intocada até a `develop` substituí-la, quando o dono do repositório decidir.

Nada entra na `develop` por push direto: todo trabalho sai de uma branch própria (`feat/`, `fix/`, `docs/`, `chore/`), cortada da `develop`, e entra por Pull Request, sem exigir aprovação de outro integrante. A exceção existe apenas quando o dono do repositório pede explicitamente, caso a caso, e não vira precedente.

A coluna Staging do Project é o que já foi mesclado na `develop`.

---

## Processo

**Backlog.** Vive no GitHub Project "Vultra". O sprint dura uma semana.

**Commits.** Conventional Commits, em inglês, assunto no imperativo, corpo explicando o porquê. Nenhuma atribuição a assistente, em nenhum trailer, nunca.

**Verificação não é auto-declarada.** Foi exatamente isso que falhou no ciclo anterior. Um gate verde no código atual prova a ausência do bug hoje; ele não prova que existe rede de proteção. Onde há guard, o teste tem que falhar quando o guard é removido.

**Documentação.** Toda decisão que cruza módulos vai para `docs/decisions/NNNN-slug.md`. As pastas `docs/backend/adrs/` e `docs/database/adrs/` guardam os ADRs anteriores e não recebem ADR novo. Um requisito novo ou alterado passa por controle de mudança em `docs/requirements/`: issue `requirement-change`, versão nova e entrada no `CHANGELOG.md`.

**Dívida.** Achado de segurança adiado vira issue `security-debt`. Os outros eixos viram `tech-debt`. Trade-off deliberado e documentado não é dívida: vira decisão. Silêncio é falha.

---

## Ferramental agêntico

Só Claude Code. As configurações de OpenCode, Copilot e as treze skills locais de `.agents/skills` foram removidas em agosto de 2026 por descreverem um sistema que não corresponde ao código.

Skill nova só nasce de uma dor concreta e repetida, e só quando nada nas skills globais já cobre o assunto.

---

## Idioma

Conversa, documentação e issues em PT-BR. Código em inglês, sem exceção: identificadores, nomes de arquivo, nomes de diretório, valores de enum e mensagens de log.

---

## Gotchas

- `insightface` 2.1 emite um `FutureWarning` do `scikit-image` 0.26 a cada alinhamento de rosto. O `scikit-image` fica fixado em 0.26.0 e o aviso é filtrado nominalmente no gate.
- `insightface` baixa os pesos do `buffalo_l` para `~/.insightface` na primeira execução, cerca de 600 MB, fora do repositório.
- Um diagrama exportado pelo draw.io sem `--svg-theme light` segue o tema do navegador: em modo escuro as caixas ficam pretas e as setas somem sobre a página clara do site. Todo `.drawio.svg` é exportado com `drawio --export --embed-diagram --svg-theme light`.
- No Windows, uma URL de banco com `localhost` faz cada conexão do psycopg esperar 130 segundos: ele tenta `::1` primeiro, onde a porta não está publicada, não percebe a recusa e só passa para `127.0.0.1` quando o tempo de conexão esgota. O cliente do Redis sofre do mesmo atraso, que estoura o tempo de conexão da cota e faz o login responder `503`. As URLs do `apps/api/.env` usam `127.0.0.1`.
- Um diagrama com mais de 880 px de largura é reduzido pelo site até o texto ficar ilegível. O layout é vertical e cabe nessa largura.

---

## Nunca

- Afirmar que algo funciona sem ter rodado.
- Fechar tarefa com gate vermelho ou aviso pendente.
- Escrever comentário que não foi pedido.
- Ler, criar ou editar qualquer arquivo `.env`, incluindo o de exemplo, sem pedido explícito.
- Dar valor padrão a variável de ambiente no ponto de leitura.
- Commitar direto na `main` ou na `develop`.
- Implementar feature não trivial sem teste escrito antes.
- Tratar `docs/requirements/` ou os ADRs como sugestão.
