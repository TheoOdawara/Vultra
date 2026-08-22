# Vultra

Chamada de alunos por reconhecimento facial, com análise afetiva como subproduto entregue a um sistema de RH construído por outra equipe. SaaS B2B multitenant, contexto de Iniciação Científica, entrega em dezembro de 2026 junto com o artigo.

A verdade de produto vive em `docs/requirements.md`. Este arquivo não a repete: ele diz como se trabalha aqui.

---

## Estado real do repositório

Leia isto antes de afirmar que algo está pronto. A auditoria de agosto de 2026 encontrou 6 achados Critical e 17 High, e o ciclo anterior fechou declarando pronto o que não estava. O que segue quebrado hoje:

- Nenhum dos três frontends processa Tailwind: não existe `postcss.config.*` em lugar nenhum, e os três declaram `@tailwindcss/postcss` com `@import "tailwindcss"` no `globals.css`.
- `0016_device_auth_migration.sql` está em disco e fora do `_journal.json`. Em qualquer ambiente migrado, autenticação de dispositivo não existe.
- `next` está fixado em `15.3.3` nos três frontends, dentro de faixa de advisory.
- Não existe configuração de ESLint em lugar nenhum, então `next lint` não checa nada nos três frontends.
- Nenhum workflow de CI existe. Todo gate roda na máquina de quem desenvolve.
- Análise afetiva não está implementada em nenhuma camada. `api-core` e `frontend-rh` leem e exibem `sentimentLabel` e `sentimentScore` que o `ai-service` nunca produz.
- O `ai-service` não tem lockfile Python. Os `bun.lock` dos apps TypeScript são versionados.
- `infra/docker-compose.yml` publica a porta `8000` do `ai-service` no host, contrariando o ADR-0001. A remoção é a issue #63.

Um agente que encontrar qualquer um desses itens já resolvido deve confirmar no código antes de acreditar.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Runtime e gerenciador | Bun, em todo o repositório |
| API | ElysiaJS + TypeBox |
| Auth | Better Auth (organization, RBAC, passkeys) |
| Banco | PostgreSQL 16 + pgvector 0.8 (imagem pinada em `0.8.6-pg16-bookworm`, ver ADR-002), `vector(512)` |
| Fila | Redis 7 |
| IA | Python 3.11, FastAPI, InsightFace `buffalo_l` (ArcFace 512d), ONNX Runtime |
| Front | Next.js 15 App Router, React 19, TanStack Query, Tailwind v4 |
| Firmware | C++/Arduino, ESP32-CAM |
| Lint | Biome no TypeScript, Ruff no Python |

---

## Comandos

Não existe `package.json` na raiz. Cada app é instalado e verificado dentro da própria pasta.

**`apps/api-core`**

```
bun install
bun run typecheck
bun run lint
bun run test
bun run db:migrate
bun run dev
```

**`apps/frontend-admin`, `apps/frontend-rh`, `apps/frontend-professores`**

```
bun install
bun run typecheck
bun run build
bun run dev
```

`bun run lint` existe nos três mas não checa nada até haver configuração de ESLint. Não conte esse comando como gate.

**`apps/ai-service`**

```
pip install -e ".[dev]"
ruff check .
mypy
pytest
uvicorn main:app --reload
```

**Stack local**

```
docker compose -f infra/docker-compose.yml up -d
docker compose -f infra/docker-compose.yml logs -f
docker compose -f infra/docker-compose.yml exec api-core bun run db:migrate
```

O `ai-service` não deve publicar porta no host (ADR-0001); hoje o compose ainda publica a `8000` — a remoção é a issue #63. Para inspecioná-lo, use `docker compose exec`.

---

## Arquitetura

`api-core` é hexagonal por camada técnica, conforme `docs/backend/adrs/ADR-004`. A dependência aponta sempre para dentro:

```
core/domain      entidades e erros de domínio, sem dependência externa
core/ports       interfaces, prefixadas com I
core/use-cases   regra de negócio, depende só de ports
adapters         http (rotas, schemas, middleware) e repositories
infrastructure   database, redis, auth, container, server
```

Regras de fronteira:

- `core` nunca importa de `adapters` nem de `infrastructure`.
- Uma rota não fala com repositório: ela chama um use-case.
- Um use-case não conhece Elysia, Drizzle nem Redis: conhece ports.
- `main.ts` só monta e escuta. Todo handler tem arquivo próprio, o health check incluído.

Fluxo de reconhecimento:

```
ESP32-CAM  →  api-core  →  Redis LPUSH ai:recognition:queue
                              ↓ BLPOP
                          ai-service  →  SETEX ai:recognition:result:{jobId}
                              ↓ polling a cada 50ms, prazo de 3s
                          api-core  →  pgvector, similaridade de cosseno
```

O contrato real entre `api-core` e `ai-service` é a fila, não HTTP. O payload está em `apps/ai-service/schemas/job_schemas.py` e é a fonte da verdade: se um campo não está lá, ele não existe, por mais que o TypeScript do outro lado o declare.

---

## Regras invioláveis

Estão em `docs/decisions/0001-baseline-de-seguranca.md`, que vale para todo o repositório. Não são repetidas aqui, e nenhuma delas é negociável por prazo. Leia esse ADR antes de tocar em rota, migration, configuração de rede ou qualquer caminho que veja dado biométrico.

O resumo em uma frase: autorização nega por padrão, tenant só via `withTenantContext()`, rate limiting em Redis falhando fechado, `ai-service` sem porta no host, TLS na borda IoT, ambiente sem fallback, nada sensível em log, e nenhuma regra vale sem um teste que falhe quando o guard some.

---

## Início de sessão e coordenação

O hook de `SessionStart` em `.claude/settings.json` imprime o brief da sessão: branch e distância de `origin/main`, PRs abertos, issues assignadas e milestones em curso. Ele é o ponto de partida, não um detalhe — sessão que ignora o brief repete trabalho ou colide com o outro integrante.

- Todo trabalho nasce de uma issue do GitHub, e a issue é assignada antes do primeiro commit.
- Antes de escolher trabalho, verifique os PRs abertos e as branches remotas ativas. Trabalho anunciado por outro não é atropelado.
- A base é sempre `origin/main` atualizada. Branch atrás da main se rebaseia antes de continuar.
- Estado compartilhado vive no GitHub (issues, PRs, milestones) e nos docs versionados. Memória local de agente não é canal de coordenação, e arquivo de estado fora do repositório não existe para o time.

---

## Processo

**Branches.** `main` é protegida. Nada entra nela por push direto. Todo trabalho sai de uma branch própria (`feat/`, `fix/`, `docs/`, `chore/`) e entra por Pull Request com aprovação do outro integrante. Somos dois: Theo e Vitor. A exceção existe apenas quando o dono do repositório pede explicitamente, caso a caso, e não vira precedente.

**Commits.** Conventional Commits, em inglês, assunto no imperativo, corpo explicando o porquê. Nenhuma atribuição a assistente, em nenhum trailer, nunca.

**Definição de pronto.** Uma tarefa não está pronta antes de, na superfície que ela tocou:

1. Gates verdes, do mais barato ao mais caro: lint, typecheck, build, testes. Zero erro e zero aviso. Erro pré-existente em arquivo tocado é consertado na mesma passada.
2. Sanidade de performance: sem N+1, sem trabalho repetido, nada pesado no caminho quente.
3. Rodou e foi observado funcionando. Evidência antes de afirmar.
4. Segurança contabilizada: corrigida, ou virou issue `security-debt` com superfície, risco e correção.

**Verificação não é auto-declarada.** Foi exatamente isso que falhou no ciclo anterior. Um gate verde no código atual prova a ausência do bug hoje; ele não prova que existe rede de proteção. Onde há guard, o teste tem que falhar quando o guard é removido.

**Testes antes do código** para lógica, regra de negócio e correção de bug. Mudança cosmética é isenta.

**Documentação.** ADR transversal vai para `docs/decisions/NNNN-slug.md`. ADR de um domínio continua em `docs/backend/adrs/` ou `docs/database/adrs/`, que é onde os oito existentes moram. Um requisito novo ou alterado atualiza `docs/requirements.md` e ganha entrada no log de evolução.

**Dívida.** Achado de segurança adiado vira issue `security-debt`. Os outros eixos viram `tech-debt`. Trade-off deliberado e documentado não é dívida: vira decisão. Silêncio é falha.

---

## Ferramental agêntico

Só Claude Code. As configurações de OpenCode, Copilot e as treze skills locais de `.agents/skills` foram removidas em agosto de 2026 por descreverem um sistema que não corresponde ao código.

Skill nova só nasce de uma dor concreta e repetida, e só quando nada nas skills globais já cobre o assunto. Não existe skill que reafirme arquitetura hexagonal, contrato de testes, desenho de API ou de banco: isso já vive fora do repositório.

---

## Idioma

Conversa, documentação e issues em PT-BR. Código em inglês, sem exceção: identificadores, nomes de arquivo, nomes de diretório, valores de enum e mensagens de log. Há literais acentuados em contrato público hoje, como `"POSSÍVEL"` em `VerifyFaceUseCase`, e eles são dívida a corrigir, não precedente a seguir.

---

## Nunca

- Afirmar que algo funciona sem ter rodado.
- Fechar tarefa com gate vermelho ou aviso pendente.
- Escrever comentário que não foi pedido.
- Ler, criar ou editar qualquer arquivo `.env`, incluindo o de exemplo, sem pedido explícito.
- Dar valor padrão a variável de ambiente no ponto de leitura.
- Commitar direto na `main`.
- Implementar feature não trivial sem teste escrito antes.
- Tratar `docs/requirements.md` ou os ADRs como sugestão.
