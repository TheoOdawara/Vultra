# Lessons Learned

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

## 2026-03-14 — Ambiente exclusivo Bun + PowerShell redirect
**O que não fazer:** Usar `npm`, `npx` ou qualquer variação. Usar `2>&1` em comandos com `bun run` no PowerShell (quebra o script)
**Padrão correto:**
- Sempre usar `bun` para executar scripts: `bun run typecheck`, `bun run dev`, etc.
- Para capturar output no PowerShell: usar apenas `| Out-String` ou deixar sem redirect
- `bun x` substitui `npx`; `bun i` substitui `npm install`

## 2026-03-14 — UUID geração no Better Auth
**O que não fazer:** Implementar manualmente a geração de UUID v7 em JS para Better Auth (causa erros de tipagem com Uint8Array em strict mode)
**Padrão correto:** Usar `advanced.database.generateId: 'uuid'` nativo do Better Auth
- O generateId aceita string literal `'uuid'` | `'serial'` | `false` ou função custom
- Os UUIDs do domínio continuam sendo v7 via `gen_uuid_v7()` no PostgreSQL (DEFAULT das colunas SQL)