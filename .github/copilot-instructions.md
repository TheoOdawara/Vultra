# Instruções do Projeto — Vultra

Ecossistema SaaS multitenant para gestão de presenças com reconhecimento facial, análise de sentimento e integração IoT, com conformidade LGPD e isolamento estrito por tenant.

---

## 1. Identidade do Projeto

- **Idioma:** Português (pt-BR) com tom técnico e assertivo — em documentação, tarefas e mensagens de trabalho.
- **Ambiente:** comandos devem permanecer portáveis para Linux nativo e CI no GitHub Actions. Não introduza dependências de shell, path ou sistema operacional sem documentação explícita em `docs/`.
- **Runtime & Package Managers:** JavaScript/TypeScript via **Bun** e **bunx**. AI Service via **Python 3.11** com tooling próprio do app (`pip`, `pytest`, `ruff`) apenas quando o escopo exigir. Não usar `npm`, `npx`, `yarn` ou `pnpm` no fluxo JS/TS do monorepo.
- **Decisões arquiteturais:** consultar sempre `README.md`, `docs/` e ADRs antes de presumir design de API, auth, biometria, filas Redis, firmware, dados ou frontend.

---

## 2. Stack do Projeto

| Camada | Decisão |
| ------ | ------- |
| Backend | Bun + TypeScript strict + ElysiaJS + TypeBox + Better Auth |
| Dados | PostgreSQL 16 + pgvector + Drizzle ORM + RLS por `organization_id` |
| AI | Python 3.11 + FastAPI + DeepFace/ArcFace + processamento **RAM-only** |
| Frontend | Next.js 15 App Router + Tailwind CSS 4 + Shadcn/UI |
| Firmware | ESP32-CAM em C++/Arduino com autenticação de dispositivo |
| Infra & Qualidade | Redis 7 + Docker/Compose + GitHub Actions + Biome + Ruff |

Todo agente deve consultar as skills relevantes (tabela abaixo) **antes** de implementar qualquer camada ou alterar governança do projeto.

---

## 3. Skills Disponíveis

Valide sempre em `skills-lock.json` antes de invocar. Se uma skill local existir mas não estiver no lock, sincronize o lock antes de tratá-la como fonte oficial do projeto.

> **Limite de ativos locais do projeto:** os únicos ativos versionados de instrução/governança do Vultra são `.github/copilot-instructions.md`, `.agents/skills/` e `.github/tasks/`.
> **Proibições estruturais:** não criar `.github/instructions/`, não criar agentes locais de projeto e não espalhar regras de governança em outros caminhos.

| Skill | Quando usar | Agente |
| ----- | ----------- | ------ |
| `vultra-context` | Contexto mestre do Vultra; carregar antes de implementação, revisão ou auditoria substantiva | — |
| `hexagonal-arch` | Use cases, ports/adapters, DI e organização do `api-core` | `@engine` |
| `elysia-typebox` | Rotas Elysia, schemas TypeBox, `derive`, validação `/v1` | `@engine` |
| `better-auth` | Sessões, RBAC, `organizationId` da sessão, autenticação humana e de dispositivos | `@engine` |
| `better-auth-best-practices` | Configuração e integração geral do Better Auth | `@engine` |
| `drizzle-orm` | Schema, queries, migrations SQL manuais, pgvector e RLS | `@engine` |
| `lgpd-biometrics` | Fluxos biométricos, consentimento, exclusão, audit log e dados sensíveis | `@engine` |
| `redis-ai-queue` | Integração API Core ↔ AI Service, Redis, Circuit Breaker e timeouts | `@engine` |
| `error-handler` | Domain errors, mapeamento HTTP e tratamento global de erros | `@engine` |
| `security-best-practices` | Hardening, rate limiting, headers, revisão OWASP e compliance | `@engine` |
| `ui-ux-pro-max` | Portais web, design system, UX e consistência visual | `@creative` |
| `elysiajs` | Referência complementar do framework quando a skill local não cobrir o caso | `@engine` |
| `skill-creator` / `criador-skills` | Criar ou evoluir skills sem introduzir agentes locais | `@engine` |

> **Nota sobre `vultra-context`:** O agente `—` indica que esta skill deve ser invocada por **qualquer** agente antes de implementação substantiva — não é exclusiva de um único agente.

---

## 4. Contexto de Negócio

- **Fluxo principal:** captura em dispositivo/autorizado → API Core → fila Redis / AI Service → embedding e análise de sentimento → decisão de presença, auditoria e relatórios.
- **Regra cardinal LGPD:** nenhuma imagem facial persiste em disco. Frames são transitórios e **RAM-only**; persistência é restrita a embeddings, metadados mínimos e trilha de auditoria.
- **Isolamento multitenant:** obrigatório em todas as camadas. `organizationId` vindo da sessão ou do dispositivo autenticado é a fonte de verdade; o banco mantém RLS como segunda linha de defesa.
- **Auditabilidade:** eventos críticos de autenticação, biometria, presença, revogação e operações sensíveis precisam de trilha rastreável.
- **Conhecimento compartilhável:** Obsidian é memória pessoal. Qualquer conhecimento portátil ou reutilizável deve ser espelhado também em ativos do repositório (`docs/`, `.github/tasks/` ou skills locais).
- **Governança repo-local:** issues, project items, backlog, links operacionais e referências de execução ficam estritamente no contexto do Vultra; nunca apontar trabalho para repositórios ou projetos não relacionados.

---

## 5. Task Management

### Arquivos e responsabilidades

| Arquivo | Papel |
| ------- | ----- |
| `.github/tasks/todo.md` | Backlog oficial e plano ativo — fonte de verdade do que está em andamento |
| `.github/tasks/history.md` | Registro permanente de entregas concluídas — apenas append |
| `.github/tasks/lessons.md` | Erros, aprendizados e regras derivadas que precisam ser reaproveitadas |

### Regras invioláveis

- Sempre ler `todo.md` antes de qualquer escrita.
- `.github/tasks/` é o único diretório canônico de task management; `.github/task/` e variações paralelas são proibidos.
- Nunca sobrescrever entradas existentes em `todo.md`, `history.md` ou `lessons.md`; apenas acrescentar contexto ou atualizar status das subtarefas.
- Migrar **todos** os itens `[x]` de `todo.md` para `history.md` **antes** de adicionar novo plano ou reordenar backlog.
- Toda correção do usuário que virar padrão reaproveitável deve ser espelhada no repositório — não apenas em memória pessoal.
- Se houver outra ferramenta de tracking, a referência ainda precisa existir nestes arquivos do Vultra; a fonte de verdade não sai do repositório.

### Prefixos de task

| Prefixo | Significado |
| ------- | ----------- |
| `[FEAT]` | Nova feature de negócio |
| `[FIX]` | Correção de bug |
| `[SEC]` | Segurança, LGPD ou correção de finding |
| `[AI]` | Pipeline de IA, biometria ou integração com o AI Service |
| `[DATA]` | Banco, migrations, RLS, pgvector ou modelos persistidos |
| `[DOCS]` | Atualização de documentação |
| `[GOV]` | Governança, bootstrap ou organização de ativos do repositório |

### Modelo de task (`todo.md`)

```markdown
# Tarefa: [Prefixo] [Nome da Task]

## Specs
- Escopo:
- Contratos:
- Critérios de aceite:

## Plano
- [ ] Etapa 1: ...
- [ ] Etapa 2: ...
- [ ] Etapa N: validação final

## Post-Mortem
- [Notas sobre riscos, débitos ou decisões pendentes]
```

### Modelo de lição (`lessons.md`)

```markdown
- [DATA] [PADRÃO]: Descrição do erro e como evitar.
- [DATA] [REGRA]: Nova regra que deve viver em assets versionados do repositório.
```

---

## 6. Recebimento de `AUDIT-REPORT.md`

Quando o usuário entregar um `AUDIT-REPORT.md`:

- Ler **todos** os findings antes de qualquer ação.
- Criar tasks `[SEC]` no `todo.md` para cada finding `CRITICAL` ou `HIGH`.
- Findings que violem RAM-only, isolamento por tenant, autenticação, RLS ou vazamento de biometria são prioridade máxima mesmo quando o relatório usar outra nomenclatura.
- Findings `MEDIUM` e `LOW` entram em `lessons.md` ou no backlog técnico com severidade/contexto explícitos.
- **Nenhum finding pode ser ignorado** sem justificativa explícita registrada em `docs/` ou no ADR correspondente.

---

## 7. Routing Matrix — Vultra

> Esta tabela estende a Routing Matrix global com os domínios e skills específicos do Vultra. Para domínios sem entrada aqui, aplicar o roteamento global diretamente.

| Domínio Vultra | Agente | Skills obrigatórias (invocar antes de implementar) |
| -------------- | ------ | -------------------------------------------------- |
| Backend: ElysiaJS, Drizzle, Better Auth | `@engine` | `hexagonal-arch`, `elysia-typebox`, `drizzle-orm`, `better-auth` |
| Biometria, LGPD, AI Queue | `@engine` | `lgpd-biometrics`, `redis-ai-queue`, `security-best-practices` |
| Portais Web, UX, Design System | `@creative` | `ui-ux-pro-max` |
| Arquitetura, ADRs, Specs | `@principal` | *(spec-writing via global)* |
| Security Audit | `@engine` | `security-best-practices` |
| Skills (criar/evoluir) | `@engine` | `criador-skills` |

**Tasks cross-domain:** para features full-stack com backend + frontend, despachar `@engine` e `@creative` em paralelo com escopos separados e explícitos. Nunca mesclar responsabilidades num único agente.

---

## 8. Comandos do Projeto

> Estes comandos são a extensão project-specific do Task Completion Protocol global. A ordem de execução é obrigatória: **lint → typecheck → format → build → test**.

| Comando | Script |
| ------- | ------ |
| Lint | `bun run lint` |
| Typecheck | `bun run typecheck` |
| Format | `bun run format` |
| Build | `bun run build` |
| Test | `bun run test` |

- Prefixo de execução obrigatório: `bun run <script>`. Nunca invocar `npm run`, `npx`, `yarn` ou `pnpm` no escopo JS/TS do monorepo.
- Todos os comandos devem ser executados a partir da raiz do monorepo, salvo instrução explícita em `docs/`.
- O loop de falha do protocolo global se aplica: iterar até que todos os comandos retornem `exit 0`.

---

## 9. Superfícies de Teste — Vultra

> Esta seção estende o Test Contract global com as superfícies e budgets específicos do Vultra. Os três eixos globais (Behavior, Security, Performance) se aplicam integralmente; aqui registram-se apenas os casos e métricas que o global não pode antecipar.

### Eixo 2 — Security (superfícies Vultra-específicas)

| Superfície | Caso obrigatório | Arquivo de cobertura |
| ---------- | ---------------- | -------------------- |
| RBAC matrix | `{admin, professor, rh, student, anônimo} × {GET, POST, PUT, DELETE}` em todo endpoint protegido | `test/integration/authz/{resource}.test.ts` |
| Biometria RAM-only | Frame não persiste após request; embedding não aparece em response body; `consent_flag` validado antes de enroll | skill `lgpd-biometrics` define os cenários |
| IoT auth | `X-Device-Token` forjado → 401; device de outro tenant → 403 | `test/integration/device-auth.test.ts` |
| Face endpoints | IDOR entre organizações → 404; rate limit: user 5 RPS burst 10 / org 20 RPS; threshold mínimo de qualidade 0.40 rejeitado no use case, não no banco | `test/integration/face/*.test.ts` |

### Eixo 3 — Performance (budgets Vultra)

| Operação | Budget | Observação |
| -------- | ------ | ---------- |
| Enroll / Verify (p95) | ≤ 3 000 ms | Alinhado ao timeout Redis configurado no `redis-ai-queue` |
| Queries pgvector | N+1 ausente | Operador `<=>`, busca vetorial direta; nunca via ORM loop |
| Rejeição de qualidade | < 0.40 rejeitado no use case | Nunca persistir frame de baixa qualidade para rejeitar no banco |

---

## 10. Paths do Closeout — Vultra

> Esta tabela mapeia cada item do Closeout Protocol global para o caminho canônico do repositório Vultra. Usar estes paths ao executar o checklist de fechamento de task.

| Item do Closeout Global | Caminho Canônico Vultra |
| ----------------------- | ----------------------- |
| Repo docs (API, schema, env vars) | `README.md` ou `docs/` |
| ADRs | `docs/decisions/` |
| CHANGELOG | `CHANGELOG.md` (raiz do monorepo) |
| Setup / run (guias de onboarding) | `README.md` seção *Quick Start* ou `CONTRIBUTING.md` |
| Migrations | `docs/migrations/` |
| Vault — padrões cross-project | `knowledge/patterns/` no vault Obsidian |
| Vault — decisões arquiteturais | `knowledge/decisions/` no vault Obsidian |
