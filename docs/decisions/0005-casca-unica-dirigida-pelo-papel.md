# 0005. Casca única dirigida pelo papel, no lugar de três grupos de rota

- Status: accepted
- Date: 2026-09-04
- Escopo: `apps/web/src/app`, `apps/web/src/middleware.ts`, `apps/web/src/modules/shell`
- Relacionada: `docs/specs/frontend-portal-forma-final.md` (SPEC-003), `docs/decisions/0004-topologia-e-fundacao-do-portal.md`, `docs/decisions/0001-baseline-de-seguranca.md`

## Context

A SPEC-003 (seção 1) e o ADR-0004 (decisão 1) desenham três grupos de rota por papel — `(manager)`,
`(teacher)` e `(hr)` —, cada um com o próprio `layout.tsx` montando a navegação daquele papel. A issue
#131 pediu exatamente essas três cascas.

Esse desenho não compila. No App Router, diretório entre parênteses não entra na URL: ele agrupa arquivos
e pendura um layout. Três rotas do mapa de telas pertencem a mais de um papel, e por isso apareceriam em
dois grupos ao mesmo tempo, resolvendo a mesma URL:

| Rota | Papéis, conforme `shared/auth/guards.ts` | Grupos onde a SPEC-003 a coloca |
| --- | --- | --- |
| `/classes` | `gestor`, `professor` | `(manager)` e `(teacher)` |
| `/reports/attendance` | `gestor`, `professor` | `(manager)` e `(teacher)` |
| `/reports/wellbeing` | `rh`, `gestor` | `(hr)` e `(manager)` |

Verificado com os dois arquivos no disco e `bun run build`:

```
You cannot have two parallel pages that resolve to the same path.
Please check /(manager)/classes and /(teacher).
```

É erro de build, não aviso. E não tem como o Next escolher entre os dois: roteamento resolve no build,
muito antes de existir sessão ou papel.

A causa não é descuido da spec: é que casca por grupo pressupõe rota de papel único, e o mapa de papéis
que o próprio ADR-0004 fixou tem rota multi-papel. As duas afirmações não cabem juntas.

## Decision

**1. Um único grupo de rota privado, `(app)`, com um layout só.** O layout lê o papel do chamador no
servidor e monta a navegação daquele papel. Cada rota existe uma vez, e quem a abre determina a casca.
Os grupos `(manager)`, `(teacher)` e `(hr)` não são criados. `(auth)` continua como a SPEC-003 desenhou.

**2. O papel chega ao layout pelo pedido, não por uma segunda consulta.** O `middleware.ts` já resolve a
sessão a cada navegação; ele passa o papel resolvido adiante no cabeçalho de requisição `x-vultra-role`,
via `NextResponse.next({ request: { headers } })`. Consultar a sessão de novo no layout dobraria a chamada
de rede no caminho quente de toda navegação.

**3. O cabeçalho é sempre reescrito, nunca aceito.** O middleware apaga qualquer `x-vultra-role` que tenha
vindo de fora e só então escreve o papel que ele mesmo resolveu. Um chamador que declare o próprio papel é
ignorado.

**4. Isso é conveniência de interface, não autorização.** A negação real continua onde estava: no
`middleware.ts` sobre o mapa de `shared/auth/guards.ts`, e no servidor (RNF-08, ADR-0001 §1). Esconder um
item de menu não protege rota nenhuma, e o teste que prova isso é o do papel `rh` alcançando `/members`:
a navegação não mostra o item **e** a rota responde a tela de acesso negado. Cada uma das duas coisas é
verificada por si.

**5. O mapa de navegação vive em um arquivo só, `shared/navigation/navigation.ts`,** e um teste confronta
cada item com `decideAccess` do mapa de guardas. Item de menu que aponte para rota que o papel não alcança
reprova o portão — a navegação não pode derivar da autorização em silêncio.

## Consequences

- O mapa de telas da SPEC-003 é entregue inteiro: mesmas rotas, mesmos rótulos, mesma navegação por papel,
  `rh` com um único item. O que muda é o arranjo de diretórios, não o que o usuário vê.
- A seção 1 da SPEC-003 e a decisão 1 do ADR-0004 ficam desatualizadas nesse ponto. Este ADR as substitui
  quanto à topologia dos grupos privados.
- Rota nova nasce em `(app)` e **precisa** de entrada no mapa de guardas para ser servida — a negação por
  omissão do #128 continua valendo sem mudança.
- O layout passa a depender de um cabeçalho posto pelo middleware. Rota privada que escape do `matcher`
  chega sem papel; nesse caso a casca não desenha navegação alguma, o que é o comportamento seguro.
- Fica um caminho aberto para separar as áreas de novo, se um dia as rotas compartilhadas deixarem de ser
  compartilhadas: basta que cada rota tenha papel único.

## Evidence

Contra um duplo da API de sessão, com o portal servindo de verdade:

- `gestor` em `/members`: oito itens, nos quatro grupos do mapa de telas.
- `professor` em `/attendance`: três itens.
- `rh` em `/reports/wellbeing`: um item.
- `/classes` servida a `gestor` e a `professor`, cada um com a própria navegação, e `Turmas` contra
  `Minhas turmas` marcado como página atual.
- `rh` em `/classes` e em `/members`: tela de acesso negado.
- Sem cookie em `/members`: `307` para `/login?next=%2Fmembers`.
