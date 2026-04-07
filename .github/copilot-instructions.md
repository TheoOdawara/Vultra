# Copilot Instructions — VULTRA

Sistema multitenant de controle de acesso biométrico para Iniciação Científica.  
Stack: **ElysiaJS + Drizzle ORM + PostgreSQL + pgvector** (backend) · **FastAPI + Redis** (microserviço IA) · **ESP32-CAM** (IoT) · **Bun** (runtime).

---

## Skills — Carregue Antes de Trabalhar

Antes de qualquer tarefa, carregue a skill correspondente à área. Detalhes técnicos de framework e pipelines vivem nas skills, não aqui.

| Área | Skill a carregar |
|------|-----------------|
| Rotas, plugins, guards | `elysiajs` |
| Validação de inputs e schemas | `elysia-typebox` |
| Autenticação e sessões | `better-auth` + `better-auth-best-practices` |
| Queries, migrations, schema Drizzle | `drizzle-orm` |
| Arquitetura Hexagonal, Result Pattern | `hexagonal-arch` |
| Centralização de erros e HTTP semântico | `error-handler` |
| Qualquer feature com dados biométricos | `lgpd-biometrics` |
| Comunicação backend ↔ microserviço Python | `redis-ai-queue` |
| Segurança geral | `security-best-practices` |
| Identidade visual e design system | `ui-ux-pro-max` |
| _(adicione conforme o projeto evoluir)_ | — |

> **Regra:** Se uma skill necessária não existir, criá-la com a skill `skill-creator` antes de começar.

---

## Protocolo de Resposta (Obrigatório em Todas as Mensagens)

Este protocolo é **mandatório** e deve ser seguido literalmente em toda mensagem recebida, sem exceção.

### Fluxo (9 Etapas)

1. **Ler a solicitação** — Interpretar com precisão o que foi pedido.
2. **Consultar conhecimentos relevantes** — Nesta ordem:
   - `.github/tasks/todo.md` (backlog atual)
   - `.github/tasks/history.md` (contexto de entregas anteriores)
   - `copilot-instructions.md` (regras vigentes)
   - Documentação técnica relevante em `/docs/` (verificar index se existir)
   - Skills pertinentes à área de trabalho
3. **Definir specs e apresentar o plano** — Detalhar escopo, contratos de interface, casos de uso e critérios de aceite. O plano **nunca** existe em memória de sessão — após aprovação, é escrito imediatamente no `todo.md`. Nenhum arquivo `plan.md` ou equivalente deve ser criado.
4. **Aguardar aprovação explícita** — Nenhuma implementação ocorre sem confirmação. Se recusado, replanejar as specs.
5. **Escrever os testes primeiro** — Com o plano aprovado e registrado no `todo.md`, implementar **todos** os testes necessários antes de qualquer código de produção. Os testes definem o contrato que a implementação deve honrar (spec-driven + TDD).
6. **Implementar** — Somente após os testes estarem prontos, escrever o código de produção para fazê-los passar. Atualizar status no `todo.md` em tempo real.
7. **Mover concluídos para `history.md`** — Antes de registrar qualquer nova task, mover todos os itens `[x]` do `todo.md` para `history.md`. Nunca acumular itens concluídos no `todo.md`.
8. **Atualizar documentação** — Ao finalizar: atualizar `/docs/` relevantes, index do `/docs/` se necessário, e `lessons.md`.
9. **Relatório final** — Resumo do que foi feito, arquivos alterados e skills utilizadas.

> Quando o usuário corrigir um erro, registrar **imediatamente** o aprendizado em `.github/tasks/lessons.md`.

---

## Git — Fluxo de Trabalho

Seguir as convenções padrão de Git e GitHub para nomenclatura de branches, commits e PRs.

- **Branches:** nomeadas pela feature/fix com prefixo convencional (`feat/`, `fix/`, `refactor/`, `chore/`, etc.).
- **Commits:** Conventional Commits obrigatório (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`).
- **Push:** sem push intermediário por sub-etapa — empurrar quando o trabalho da branch estiver coeso.
- **PR:** abrir somente quando a entrega estiver concluída e os testes passando. Nunca abrir PR com trabalho em andamento.

---

## Regras Críticas de Negócio

Estas regras são invioláveis em qualquer feature, refatoração ou fix.

### Multitenancy

- **Todas** as tabelas e queries devem filtrar por `organizationId`.
- Fuga de dados entre tenants é um **bug crítico** — sem exceções.
- Todo teste de rota deve cobrir isolamento de `organizationId`.

### Segurança Biométrica (LGPD)

- **Proibido** armazenar imagens brutas em qualquer camada — backend, microserviço, logs ou storage.
- Pipeline obrigatório (ordem inviolável): frame JPEG → detecção (RetinaFace) → recorte + normalização → embedding ArcFace `vector(512)` → descartar imagem da memória → persistir **apenas o vetor**.
- Consultar obrigatoriamente a skill `lgpd-biometrics` em qualquer feature que envolva dados biométricos.

### Arquitetura

- Isolar estritamente o `Core (Domain)` de `Adapters` externos — via skill `hexagonal-arch`.
- Usar Result Pattern. Proibido `throw` para erros de negócio.
- Proibido `any` em TypeScript. Strict Mode obrigatório.
- Todas as rotas iniciam com prefixo `/v1/`.
- Todas as rotas têm validação TypeBox obrigatória — proibido Zod ou Joi.

### IoT

- Autenticação de dispositivos: Static API Keys via header `X-Device-Token`, validadas contra `deviceId`.

---

## Task Management

### `tasks/todo.md` — Backlog oficial

- Fonte de verdade do projeto.
- Sempre ler o estado atual antes de qualquer alteração.
- Nunca sobrescrever conteúdo existente sem leitura prévia.
- Itens concluídos (`[x]`) devem ser movidos para `history.md` antes de qualquer nova adição.

### `tasks/history.md` — Registro permanente

- Destino de todos os itens concluídos removidos do `todo.md`.
- Nunca apagar entradas existentes — apenas acrescentar ao final.
- Cada item deve manter contexto original (nome da task, data de conclusão).

### `tasks/lessons.md` — Conhecimento acumulado

- Registrar erros corrigidos e padrões descobertos imediatamente após ocorrência.
- O arquivo deve ter um **índice no topo**, atualizado a cada nova entrada, para o agente localizar rapidamente a categoria relevante antes de ler o conteúdo completo.
- Ao consultar `lessons.md`, ler o índice primeiro e ir diretamente às categorias pertinentes à task atual — não ler o arquivo inteiro.

**Estrutura do arquivo:**

```markdown
# Lessons — Índice

- [MULTITENANCY] linha X
- [LGPD] linha X
- [FRAMEWORK] linha X
- [TESTES] linha X
- [ARQUITETURA] linha X

---

## [CATEGORIA]

- [YYYY-MM-DD]: Descrição do erro e como evitar.
- [YYYY-MM-DD] [REGRA]: Sugestão de nova regra para copilot-instructions.md.
```

### Tipos de Task

| Prefixo | Significado |
|---------|-------------|
| `[FEAT]` | Nova feature de negócio |
| `[FIX]` | Correção de bug |
| `[SEC]` | Correção de finding de segurança |
| `[UI]` | Componente visual |
| `[REFACTOR]` | Refatoração técnica |
| `[DOCS]` | Atualização de documentação |
| `[IOT]` | Feature ou fix no firmware ESP32 |
| `[AI]` | Feature ou fix no microserviço Python (InsightFace / DeepFace) |

### Modelo — `todo.md`

```markdown
# Tarefa: [PREFIXO] Nome da Task

## Specs
- Escopo: [o que entra e o que não entra]
- Contratos: [interfaces, tipos, endpoints]
- Critérios de aceite: [como saber que está pronto]

## Plano
- [ ] Etapa 1: Testes (escrever antes de qualquer implementação)
- [ ] Etapa 2: Implementação (fazer os testes passarem)
- [ ] Etapa 3: Migrations/Database (se aplicável)
- [ ] Etapa 4: Validação e build

## Post-Mortem
- [Notas sobre desafios ou débitos técnicos]
```

---

## Testes

Testes são parte da entrega, não uma fase opcional. Uma task só pode ser marcada `[x]` após `bun test` passar sem erros.

- **Runner:** `bun test` — sem Jest, sem Vitest, sem dependência extra.
- **Localização:** `__tests__/` junto ao módulo, sufixo `.test.ts`.
- **Nomenclatura:** `describe` com nome do caso de uso ou rota; `it` descrevendo comportamento em português.
- **Cobertura obrigatória por rota:** sucesso, input inválido, sem token, role errada, isolamento de `organizationId`.
- **Proibido:** marcar task `[x]` com testes falhando ou ausentes em rotas e casos de uso novos.

---

## Recebimento de Relatório de Revisão (`AUDIT-REPORT.md`)

Quando o usuário entregar um `AUDIT-REPORT.md`:

- Ler **todos** os findings antes de qualquer ação.
- Criar tasks `[SEC]` no `todo.md` para cada finding `CRITICAL` ou `HIGH`.
- Findings `MEDIUM` e `LOW` entram como débito técnico no `lessons.md`.
- Nenhum finding pode ser ignorado sem justificativa registrada em ADR.

---

## Regras — Nunca Faça

- **Nunca** implemente sem apresentar specs, aguardar aprovação e escrever os testes primeiro.
- **Nunca** crie `plan.md` — o plano aprovado vai direto para o `todo.md`.
- **Nunca** abra PR com trabalho em andamento ou testes falhando.
- **Nunca** tome decisões de arquitetura sem consultar `/docs/` e skills relevantes.
- **Nunca** armazene imagens brutas em qualquer camada — biometria é apenas vetor.
- **Nunca** execute uma query sem filtro de `organizationId`.
- **Nunca** marque task como `[x]` com `bun test` falhando.
- **Nunca** acumule itens `[x]` no `todo.md` — mova para `history.md` antes de qualquer nova adição.
- **Nunca** crie uma skill sem usar a skill `skill-creator`.

---

## Convenções de Código

| Elemento | Padrão |
|----------|--------|
| Arquivos e diretórios | `kebab-case` |
| Classes | `PascalCase` |
| Funções e variáveis | `camelCase` |
| Constantes | `UPPER_SNAKE_CASE` |

- **Idioma:** Português (pt-BR), tom técnico e assertivo.
- TypeScript Strict em todo o projeto. Proibido `any`.

---

## Princípios

- **Cirúrgico:** Mudanças mínimas e precisas. Sem side-effects.
- **Skills primeiro:** Nenhum detalhe técnico de framework vive aqui — vive em skill.
- **Sem hand-holding:** Analise erros autonomamente e proponha correções. Só escale o que for decisão de negócio ou arquitetura.
- **Multitenancy é inviolável:** Query sem `organizationId` é bug crítico.
- **Biometria não persiste imagem:** Nunca. Em nenhuma camada. Em nenhum log.

---

**Última atualização:** Abril 2026 | **Versão:** 2.0.0 | **Projeto:** VULTRA