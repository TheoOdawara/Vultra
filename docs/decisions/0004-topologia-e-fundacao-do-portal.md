# 0004. Topologia e fundação do portal

- Status: accepted
- Date: 2026-08-16
- Escopo: `apps/web`, `packages/types`, e todo consumidor de `/v1` com interface
- Relacionada: `docs/specs/frontend-portal-forma-final.md` (SPEC-003), `docs/specs/api-core-contrato-e-estrutura.md` (SPEC-002), `docs/decisions/0001-baseline-de-seguranca.md`

## Context

O repositório tem três aplicações Next.js — `frontend-admin`, `frontend-rh` e `frontend-professores` —
que são a mesma aplicação copiada três vezes. `package.json`, `middleware.ts`, `lib/api.ts`,
`lib/auth-client.ts`, `lib/query-client.ts` e `lib/utils.ts` estão duplicados linha a linha nos três. O
único código realmente compartilhado é `packages/types`. Somadas, as três têm 2.111 linhas de tela.

Quatro forças pressionam agora:

1. **O contrato que elas consomem deixou de existir.** A SPEC-002 troca o envelope de coleção, a forma de
   erro, a paginação, os nomes das rotas biométricas e o conjunto de papéis. Nenhuma das telas atuais
   compila contra ele, e `frontend-professores` já chama duas rotas que nunca existiram.
2. **Nada de Tailwind funciona.** Não existe `postcss.config.*` em nenhum dos três, embora os três
   declarem `@tailwindcss/postcss` e `@import "tailwindcss"`. Toda a aparência atual é uma folha em branco.
3. **Requisitos de interface sem executor.** RNF-16 a RNF-19 — mobile-first, quatro estados, estado na
   URL, operável por teclado — não têm nada que os cumpra hoje, e nenhum teste de frontend existe.
4. **Duas pessoas e uma entrega em dezembro de 2026** (RNF-20, RNF-21). Manter três builds, três
   configurações e três lockfiles é custo recorrente que não compra nada.

O ADR-0001 continua valendo integralmente: nenhuma decisão abaixo negocia com ele.

## Decision

**1. Um único app, `apps/web`, com três áreas por papel.** Grupos de rota `(auth)`, `(manager)`,
`(teacher)` e `(hr)`. O middleware resolve o papel da sessão e serve a área. Os três apps atuais são
removidos, não migrados.

**2. Estrutura fatiada por módulo de negócio**, espelhando o que a SPEC-002 fez no `api-core`:
`src/modules/<módulo>/` para tela e lógica de tela, `src/shared/` para o que atravessa. A seta é
`app → modules → shared`, nunca ao contrário, e um módulo alcança outro apenas pelo `index.ts`.

**3. Autorização de rota nega por omissão.** O mapa rota→papel vive em um único arquivo,
`shared/auth/guards.ts`, e uma rota sem declaração não é servida. Esconder controle na interface é
conveniência, nunca autorização — a negação real permanece no servidor (RNF-08, ADR-0001 §1).

**4. Primitivos de UI vêm do shadcn/ui via CLI, sobre Radix.** Foco, `Escape`, `aria-*` e portal são
resolvidos pela biblioteca. Nenhuma tela constrói diálogo, combobox ou menu na mão.

**5. Tokens de design obrigatórios, com tema claro, escuro e `system` como padrão.** Toda cor, raio e
tamanho de fonte sai de um token declarado em `globals.css`. Cor crua do Tailwind na tela é defeito.

**6. Biome é o único linter. `next lint` é removido, não configurado.** O repositório já decidiu Biome
para TypeScript; dois linters sobre o mesmo código custa mais do que as regras de otimização de imagem e
fonte que se perdem.

**7. O portão de qualidade do frontend inclui teste.** Vitest + Testing Library com MSW interceptando na
rede, Playwright nos fluxos críticos em dois projetos (`1280×800` e `390×844` com toque), e `axe-core`
dentro do E2E reprovando violação `serious` ou `critical`.

**8. Cadastro biométrico aceita webcam e arquivo, como caminhos equivalentes.** A garantia de vivacidade é
do servidor — o `ai-service` roda `MiniFASNetV2` sobre todo quadro nos três fluxos (ADR-0002) —, então
uma foto de foto reprova venha de onde vier. A webcam não prova nada por si: o cliente controla os bytes
enviados de qualquer forma. Fazer da origem do quadro uma medida de segurança seria segurança de fachada.

**9. O acesso nasce por convite.** O formulário de cadastro de membro só cria papel `student`, que não
autentica. Papel com login nasce por convite do gestor, com senha definida pelo próprio convidado. Isso
mantém trilha de quem concedeu acesso a quem, e tira do gestor a posse da senha alheia.

**10. Offline é exclusivo da correção manual de presença.** A fila persiste em IndexedDB e só aceita as
duas operações que a SPEC-002 tornou idempotentes. Leitura, abertura e fechamento de sessão exigem rede.

**11. Nenhuma resposta de `/v1` entra em cache de disco.** O service worker cacheia apenas o app shell.
Dado biométrico e de presença não sobrevivem à sessão do navegador (RNF-01, RNF-03).

**12. `packages/types` continua sendo a fonte única do contrato**, reescrito para a SPEC-002.

**13. O navegador fala com a API diretamente, por CORS.** As reescritas `/api/v1/:path*` de
`next.config.ts` são removidas: elas escondiam a fronteira real entre portal e API e faziam o servidor
Next carregar tráfego que não é dele. A origem do portal entra na lista de origens confiáveis da API, sem
curinga e sem par com credencial. Isso fecha a decisão pendente registrada na issue #46.

## Consequences

**Fica mais fácil.** Uma configuração, um build, um portão de qualidade, um lugar onde a autorização de
rota é decidida. Um requisito transversal — tema, acessibilidade, estado na URL — é implementado uma vez em
vez de três. O contrato passa a ter um consumidor só, então quebrá-lo é visível imediatamente.

**Fica mais difícil.** Um deploy único: uma falha derruba os três públicos ao mesmo tempo. O bundle carrega
o roteamento das três áreas, ainda que o código de tela seja separado por rota. Uma mudança na área do
gestor exige rodar o portão inteiro, incluindo o E2E do professor.

**O que se aceita.** Perder as regras específicas do `eslint-config-next`. Perder deploy independente por
papel — o produto tem uma instituição por tenant e dois desenvolvedores, e a granularidade não se paga.
Aceitar Radix, `react-hook-form`, `zod`, Serwist e `idb-keyval` como dependências novas, cada uma
justificada por um requisito nomeado. Aceitar que a fila offline cobre apenas a correção manual, e que o
professor sem rede não abre sessão.

**O que morre.** Os três diretórios de app. As nove leituras de `process.env` com valor padrão. O padrão
de tela que escreve cor crua. O `next lint` que não checa nada. O `websocket.ts` que não fala WebSocket. E
`dashboard/chamada/`, que é nome de diretório em português.

## Alternatives considered

- **Manter três apps e extrair `packages/ui`, `packages/api-client`, `packages/env`.** Preserva deploy
  independente. Rejeitada: sem `package.json` na raiz e sem workspace, cada pacote novo vira mais um
  `bun install` e mais um alias de `tsconfig` para manter em três lugares. Paga-se o custo da separação
  sem ter o problema que ela resolve.
- **Dois apps, gestão e chamada.** Separa pelo contexto de uso real, não pelo papel. Rejeitada: o
  professor consulta frequência e turmas, então ele atravessaria os dois apps de qualquer forma.
- **Migrar tela por tela, com a fundação convivendo com o que existe.** Sempre haveria algo rodando.
  Rejeitada: o contrato mudou tanto que a convivência exigiria manter dois clientes de API e dois
  conjuntos de tipos vivos ao mesmo tempo, e nenhuma tela atual sobrevive à mudança de envelope, de erro e
  de paginação.
- **Primitivos próprios sem Radix.** Zero dependência nova. Rejeitada: trap de foco, portal e ARIA de
  diálogo e de combobox é exatamente onde a implementação atual já falha, e RNF-19 é requisito.
- **ESLint com `eslint-config-next` ao lado do Biome.** Recupera as regras específicas do Next.
  Rejeitada: duas ferramentas discordando sobre o mesmo arquivo é um custo permanente por um ganho de
  otimização que nenhum requisito pede.
- **Somente upload de arquivo no cadastro biométrico.** Muito mais simples de construir e de testar.
  Rejeitada: o gestor perderia o caminho de cadastrar o aluno que está na frente dele.
- **Somente webcam, com upload proibido por causa de RF-22.** Rejeitada por ser falsa: a verificação de
  vivacidade é passiva e single-frame, roda no servidor, e não distingue a origem do quadro. Proibir o
  upload não aumentaria a segurança em nada e removeria um caminho legítimo.
- **PWA sem fila offline, apenas reconexão.** Bem mais barato. Rejeitada por decisão de produto: o
  professor usa o celular em sala, e perder uma correção manual por queda de rede é perder dado que só ele
  tinha.
- **Proxy same-origin pelo servidor Next**, mantendo as reescritas. Evitaria configurar CORS. Rejeitada:
  o portal passaria a ser um salto de rede a mais no caminho de toda requisição, inclusive do quadro
  facial, sem nada em troca além de esconder de onde o dado vem.
- **Cache de resposta de API no service worker.** Melhoraria a percepção de velocidade. Rejeitada: gravaria
  dado de presença em disco, o que RNF-01 e RNF-03 não permitem.
