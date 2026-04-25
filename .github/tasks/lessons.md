# Lessons Learned

> Diretório canônico de task management: `.github/tasks/`
> Registre aqui erros repetíveis, regras derivadas e correções que precisem ser reaproveitadas em assets versionados do Vultra.

## 2026-03-14 — Arquivos de Tarefa Obrigatórios
**O que não fazer:** Iniciar planeamento sem consultar/atualizar `todo.md` e `lessons.md`
**Padrão correto:**
1. Consultar `lessons.md` e `todo.md` ANTES de qualquer execução
2. Ao aprovar um plano → transcrever para `todo.md`
3. Ao iniciar NOVO plano → mover `todo.md` atual para `history.md` (append) antes de sobrescrever
4. Ao cometer erro ou receber correção → registrar aqui com data e descrição

## 2026-03-14 — Passkey não disponível no better-auth 1.5.5
**O que não fazer:** Assumir que todos os plugins listados na documentação estão disponíveis na versão instalada
**O que aconteceu:** `better-auth/plugins/passkey` não existe na versão 1.5.5 — não há export nem ficheiro no dist
**Padrão correto:**
- Verificar exports reais do pacote instalado antes de importar plugins
- Criar migration/schema para uso futuro mas não registar no adapter
- Adicionar comentário explícito em `auth-schema.ts` indicando versão mínima necessária

## 2026-03-14 — Ambiente Bun-first e shell portável
**O que não fazer:** Usar `npm`, `npx`, `yarn` ou `pnpm` no fluxo JS/TS do monorepo. Introduzir comandos dependentes de PowerShell/Windows quando a execução precisa permanecer portável para Linux e CI.
**Padrão correto:**
- Sempre usar `bun` para executar scripts: `bun run typecheck`, `bun run dev`, etc.
- Preferir comandos compatíveis com shell POSIX e com a esteira de CI do repositório
- Documentar em `docs/` qualquer exceção de ambiente se algum app exigir tooling específico
- `bun x` substitui `npx`; `bun i` substitui `npm install`

## 2026-03-14 — UUID geração no Better Auth
**O que não fazer:** Implementar manualmente a geração de UUID v7 em JS para Better Auth (causa erros de tipagem com Uint8Array em strict mode)
**Padrão correto:** Usar `advanced.database.generateId: 'uuid'` nativo do Better Auth
- O generateId aceita string literal `'uuid'` | `'serial'` | `false` ou função custom
- Os UUIDs do domínio continuam sendo v7 via `gen_uuid_v7()` no PostgreSQL (DEFAULT das colunas SQL)

## 2026-04-25 — Estabilização pós-merge quebrado
**O que não fazer:** Tratar o repositório como recuperado apenas porque os arquivos “parecem” corretos após resolver conflitos manualmente.
**Padrão correto:**
1. Buscar markers `<<<<<<<|=======|>>>>>>>` no repositório inteiro
2. Validar `package.json` com parser real
3. Rodar `python -m py_compile` nos módulos Python afetados
4. Confirmar import/startup mínimo da app principal
5. Remover `__pycache__` e `*.pyc` do tracking antes de seguir para a próxima execução

## 2026-04-25 — PostgreSQL local deve isolar porta por projeto
**O que não fazer:** Assumir `localhost:5432` como porta segura para qualquer stack local do monorepo.
**Padrão correto:**
1. Verificar se a porta está ocupada por outro serviço externo ao projeto
2. Alinhar `DATABASE_URL`, `infra/.env` e `docker-compose.yml` para a porta efetiva do stack local
3. Validar `bun run db:migrate` contra o PostgreSQL do próprio projeto antes de tratar a execução de dados como concluída
