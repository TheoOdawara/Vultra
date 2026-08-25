<!-- Título em Conventional Commits, em inglês. Corpo em PT-BR. -->

## O quê e por quê

<!-- O problema, a decisão tomada e o link para spec/ADR quando houver. -->

Issue: #
Milestone:

## Definição de pronto (CLAUDE.md — Processo)

- [ ] Gates verdes na superfície tocada, do mais barato ao mais caro (lint → typecheck → build → testes), zero erro e zero aviso — evidência colada abaixo
- [ ] Guard novo ou alterado provado por mutante: removendo o guard o teste fica vermelho; restaurando, verde
- [ ] Rodou e foi observado funcionando — evidência real, não descrição
- [ ] Sanidade de performance: sem N+1, sem trabalho repetido, nada pesado no caminho quente
- [ ] Segurança contabilizada: corrigida aqui, ou issue `security-debt` aberta e referenciada
- [ ] Requisito novo ou alterado refletido em `docs/requirements.md` com entrada no log de evolução
- [ ] Nenhum arquivo `.env` lido ou editado sem pedido explícito

## Evidência dos gates

```
(cole aqui a saída real dos comandos)
```

## Fora de escopo / dívida registrada

<!-- O que ficou de fora e em qual issue está rastreado. Silêncio é falha. -->
