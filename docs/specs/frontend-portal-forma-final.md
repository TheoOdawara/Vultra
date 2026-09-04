# SPEC-003 — Portal do Vultra: forma final da interface

> **Status:** publicada
> **Perfil:** UI
> **Módulo:** `apps/web`
> **Epics:** #109 (F1) · #110 (F2) · #111 (F3) · #112 (F4) · #113 (F5)
> **Requisitos cobertos:** RF-02 a RF-14, RF-20, RF-21, RNF-05, RNF-08, RNF-16 a RNF-19, RNF-21
> **Depende de:** `docs/specs/api-core-contrato-e-estrutura.md` (SPEC-002) — o contrato consumido aqui é o dela, não o atual
> **Decisão relacionada:** `docs/decisions/0004-topologia-e-fundacao-do-portal.md`

Esta spec descreve a interface do Vultra na sua **versão final**: um app, três áreas por papel, e todas as
telas que os requisitos exigem — inclusive as que hoje não existem. Ela é dividida em cinco epics ao final
do documento.

Três coisas justificam refazer em vez de estender. Primeira: **os três apps são o mesmo app copiado três
vezes** — `package.json`, `lib/api.ts`, `lib/auth-client.ts`, `lib/query-client.ts`, `lib/utils.ts` e
`middleware.ts` estão duplicados linha a linha nos três, e o único código compartilhado é
`packages/types`. Segunda: **o contrato que as telas consomem deixou de existir** — a SPEC-002 troca o
envelope de coleção, a forma de erro, a paginação por cursor, os nomes de rota biométrica e o conjunto de
papéis; nenhuma das 2.111 linhas de tela atuais compila contra ele. Terceira: **o contrato já está
quebrado hoje** — `frontend-professores` chama `/v1/attendance/records` e `/v1/biometric/`, e nenhuma das
duas existe.

---

## Acceptance Criteria

### Referência visual

`N/A — não existe protótipo nem identidade visual definida.` O layout é determinado pelos tokens da
seção 3, pelos primitivos da seção 4 e pelas regras de negócio deste documento. Nenhuma tela escolhe cor,
espaçamento, raio ou tipografia por conta própria.

### 1. Topologia

Os três apps são substituídos por **um único app Next.js**, `apps/web`. `apps/frontend-admin`,
`apps/frontend-rh` e `apps/frontend-professores` são removidos.

```
apps/web/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   ├── accept-invitation/[invitationId]/
│   │   │   ├── forgot-password/
│   │   │   └── reset-password/
│   │   ├── (manager)/
│   │   │   ├── members/ · member-imports/ · classes/ · devices/
│   │   │   ├── biometric-profiles/ · audit-logs/ · retention/
│   │   │   ├── reports/attendance/
│   │   ├── (teacher)/
│   │   │   ├── attendance/ · classes/ · reports/attendance/
│   │   ├── (hr)/
│   │   │   └── reports/wellbeing/
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── modules/
│   │   └── <module>/{components,hooks,schemas}/
│   ├── shared/
│   │   ├── api/          http.ts · contracts/ · <module>.api.ts
│   │   ├── auth/         auth-client.ts · guards.ts
│   │   ├── env/          env.ts
│   │   ├── ui/           primitivos shadcn + composições próprias
│   │   └── url-state/    hooks de estado na URL
│   └── middleware.ts
├── e2e/                  Playwright
└── public/               manifest, ícones
```

> **Corrigido pelo ADR-0005.** Os grupos `(manager)`, `(teacher)` e `(hr)` desenhados acima não
> compilam: `/classes`, `/reports/attendance` e `/reports/wellbeing` pertencem a mais de um papel e
> resolveriam a mesma URL em dois grupos, o que o App Router recusa no build. As rotas privadas vivem em
> um único grupo `(app)`, cujo layout monta a navegação do papel do chamador. O mapa de telas abaixo vale
> integralmente; só o arranjo de diretórios muda.

Regras de fronteira:

- Um `modules/<módulo>/` alcança outro **apenas** por componente exportado no seu `index.ts`. Nunca por
  caminho interno.
- `shared/` não importa de `modules/`. A seta é `app → modules → shared`, nunca ao contrário.
- Nenhum componente chama `fetch` direto: toda chamada passa por `shared/api/<módulo>.api.ts`.
- Nenhum arquivo lê `process.env` fora de `shared/env/env.ts`.
- Teste fica ao lado do arquivo que testa. Não existe árvore paralela de testes, exceto `e2e/`.

**Nome de arquivo, de diretório e de segmento de rota é inglês**, sem exceção — segmento de rota é nome de
diretório. Rótulo exibido é PT-BR. O `dashboard/chamada/` atual viola isso e desaparece.

### 2. Mapeamento de papel para área

| Papel na API | Grupo de rota | Rota inicial após login |
| --- | --- | --- |
| `gestor` | `(manager)` | `/members` |
| `professor` | `(teacher)` | `/attendance` |
| `rh` | `(hr)` | `/reports/wellbeing` |

O nome do grupo de rota é inglês porque é diretório; o valor do papel é o literal que a SPEC-002 fixou e
não é traduzido em nenhum ponto do cliente.

### 3. Tokens e tema

Todos os tokens vivem em `src/app/globals.css`, na sintaxe `@theme` do Tailwind v4. **Nenhuma tela escreve
cor, raio, sombra ou tamanho de fonte crua** — `bg-white`, `text-gray-900`, `bg-blue-600` e afins são
defeito, não variação.

| Token | Claro | Escuro |
| --- | --- | --- |
| `--color-background` | `#ffffff` | `#0b0d10` |
| `--color-surface` | `#f7f8fa` | `#14181d` |
| `--color-border` | `#e2e5ea` | `#2a3038` |
| `--color-foreground` | `#111418` | `#e8eaed` |
| `--color-muted` | `#5c6470` | `#9aa3af` |
| `--color-primary` | `#1d4ed8` | `#60a5fa` |
| `--color-primary-foreground` | `#ffffff` | `#0b0d10` |
| `--color-success` | `#15803d` | `#4ade80` |
| `--color-warning` | `#b45309` | `#fbbf24` |
| `--color-danger` | `#b91c1c` | `#f87171` |

- Tipografia: uma única família, a pilha do sistema, com escala `12 · 14 · 16 · 20 · 24 · 32` px.
- Raio: `--radius-sm 6px`, `--radius-md 10px`, `--radius-lg 14px`.
- Espaçamento: múltiplos de `4px`, via escala nativa do Tailwind.
- **Tema:** três estados — `light`, `dark` e `system`. O padrão é `system`, resolvido por
  `prefers-color-scheme`. A escolha explícita persiste em `localStorage` na chave `vultra.theme` e é
  aplicada antes da primeira pintura por script inline no `<head>`, de modo que não há piscada de tema.
- **Contraste:** todo par de token texto/fundo atinge no mínimo `4.5:1` nos dois temas. É verificado em
  teste automatizado, não por inspeção.

### 4. Primitivos de UI

Origem: **shadcn/ui via CLI**, sobre Radix UI, copiados para `src/shared/ui/`. Nenhuma tela constrói
diálogo, combobox, tooltip ou menu na mão — Radix resolve foco, `Escape`, `aria-*` e portal, que é
exatamente onde a implementação atual falha.

Primitivos exigidos: `button`, `input`, `label`, `select`, `textarea`, `checkbox`, `dialog`,
`alert-dialog`, `dropdown-menu`, `table`, `badge`, `card`, `tabs`, `skeleton`, `sonner` (toast), `form`,
`popover`, `calendar`, `tooltip`, `sheet` (navegação em telefone).

Formulário: `react-hook-form` + `zod`, que é o que o primitivo `form` do shadcn usa. O schema `zod` de cada
formulário espelha os limites que a SPEC-002 declara para o mesmo campo — o cliente valida antes de enviar,
e o servidor continua sendo a autoridade.

Tabela: `@tanstack/react-table`, já instalado. Gráfico: `recharts`, já instalado.

### 5. Os quatro estados (RNF-17)

Toda superfície que depende de dado remoto declara os quatro estados. Faltar um é defeito.

| Estado | Regra |
| --- | --- |
| Carregando | `skeleton` que ocupa **exatamente** o espaço do conteúdo final. Quando o dado chega, nada na tela se move: `CLS = 0`, verificado em teste. O esqueleto reusa o mesmo componente do conteúdo, com o dado substituído por barras — nunca uma altura inventada |
| Vazio | Texto que diz o que está vazio e, quando o papel permite criar, o botão da ação primária |
| Erro | Mensagem literal derivada do `code` da API, o `correlationId` copiável e um botão `Tentar de novo` |
| Sucesso | O conteúdo |

### 6. Estado na URL (RNF-18)

Vivem em `searchParams`, nunca só em `useState`: busca, filtros, ordenação, cursor de página, período de
relatório, aba selecionada e **o identificador da sessão de chamada em andamento**.

- A escrita é `router.replace`, não `push` — digitar em um filtro não empilha histórico.
- A leitura passa por um hook tipado em `shared/url-state/`, que valida contra um schema `zod`; parâmetro
  inválido cai no padrão declarado e não quebra a tela.
- Recarregar a página reconstrói a tela inteira a partir da URL.

### 7. Cliente de API

Um único `shared/api/http.ts`. Toda chamada passa por ele.

- Base: `NEXT_PUBLIC_API_URL`, sem valor padrão. As reescritas de `next.config.ts` são removidas — o
  navegador fala com a API diretamente, e a origem do portal entra na lista de origens confiáveis da API.
- `credentials: "include"` em toda requisição.
- Envia `X-Correlation-Id` gerado por requisição (UUID v7) e lê o valor ecoado da resposta.
- Erro: lê a forma `{ error: { code, message, correlationId, details? } }` da SPEC-002 e lança
  `ApiError` com `status`, `code`, `correlationId` e `details`. **O cliente ramifica por `code`**, nunca
  pela prosa em inglês vinda do servidor.
- `429`: lê `Retry-After` e expõe no erro.
- `304`: tratado como "sem novidade", não como falha.
- Paginação: apenas cursor. `offset` desaparece do cliente.
- Coleção: apenas o envelope `{ items, page: { nextCursor, limit } }`. **Não existe `total`** — nenhuma
  tela exibe contagem total de coleção, e a paginação é `Anterior`/`Próximo` por pilha de cursores mantida
  na URL.

Tipos do contrato: `packages/types` permanece como fonte única, reescrito para a SPEC-002. `MemberRole`
passa a `"gestor" | "professor" | "rh" | "student"`, onde `student` é papel de cadastro sem login. Os tipos
de rota biométrica antiga, o envelope com `total` e a forma de erro `{ error: string }` são apagados.

TanStack Query: `staleTime` `30_000` ms; `retry` `0` para status `< 500`, `1` para o resto; `retry` `0` em
toda mutação.

### 8. Autenticação e autorização de tela

- Better Auth com `emailAndPassword` e o plugin `organization`, contra `/api/auth/*` da API.
- `middleware.ts` valida a sessão no servidor a cada navegação de página, deriva o papel e **nega por
  omissão**: uma rota que não declara papel permitido não é servida. O mapa rota→papel vive em um único
  arquivo, `shared/auth/guards.ts`.
- O matcher exclui `_next/static`, `_next/image`, `favicon.ico`, `manifest.webmanifest`, `sw.js` e
  qualquer caminho com extensão — hoje o middleware faz uma chamada de rede a cada asset.
- **Esconder controle não é autorização (RNF-08).** A interface esconde o que o papel não alcança, e isso
  é conveniência; a negação real é do servidor, e todo `403` é tratado como resposta esperada.
- Sessão expirada: qualquer `401` limpa o cache do TanStack Query e redireciona para
  `/login?next=<rota atual>`, exibindo `"Sua sessão expirou. Entre novamente."`.
- **Sair limpa tudo.** `authClient.signOut` é seguido de `queryClient.clear()` e do descarte de todo estado
  local do app antes do redirecionamento. Dado de um usuário nunca sobrevive na memória do navegador para
  o próximo — hoje o cache persiste no logout, o que a issue #26 registra como dívida de segurança.
- **Transporte:** o navegador fala com a API diretamente, por CORS, com a origem do portal na lista de
  origens confiáveis. As reescritas `/api/v1/:path*` de `next.config.ts` desaparecem: elas escondiam a
  fronteira real e faziam o servidor Next carregar tráfego que não é dele. Fecha a decisão pendente na
  issue #46.

### 9. Acessibilidade (RNF-19)

- Todo campo tem `<label>` associado por `htmlFor`. Nenhum campo usa `placeholder` como rótulo.
- Foco visível em todo elemento interativo, com anel de `2px` no token `--color-primary` e `offset` de
  `2px`. `outline: none` sem substituto é defeito.
- Ordem de tabulação segue a ordem visual. Diálogo prende o foco e devolve ao gatilho ao fechar.
- Toda ação destrutiva é alcançável por teclado e confirmada por `alert-dialog`.
- Área mínima de toque `44 × 44` px em qualquer controle no grupo `(teacher)`.
- Mudança assíncrona de estado é anunciada por região `aria-live="polite"`; erro por `aria-live="assertive"`.
- Ícone sem texto tem `aria-label`.

### 10. Mobile-first (RNF-16)

- Toda tela é decidida em `390` px e só então expandida. A verificação abre o telefone antes do desktop, na
  barra de dispositivo do DevTools — redimensionar a janela não conta.
- Nenhuma página rola horizontalmente em `390` px. Tabela e gráfico rolam **dentro do próprio container**,
  com `overflow-x: auto`.
- Em `< 768` px a navegação é um `sheet` acionado por botão no cabeçalho; em `≥ 768` px é lateral fixa.
- A tela de chamada é a única otimizada para uso com uma mão: ações primárias no terço inferior.

### 11. PWA e fila offline

- `manifest.webmanifest` com nome `Vultra`, `display: "standalone"`, ícones `192` e `512` px e
  `theme_color` resolvido pelo tema.
- Service worker por **Serwist**, com cache do app shell apenas. **Nenhuma resposta de API é cacheada pelo
  service worker** — dado de presença e dado biométrico não entram em cache de disco (RNF-01, RNF-03).
- **Fila offline, exclusiva da correção manual de presença.** Só entram na fila
  `PUT /v1/attendance/sessions/{sessionId}/records/{memberId}` e o `DELETE` correspondente, que a SPEC-002
  definiu idempotentes — é o que torna o reenvio seguro.
  - Armazenamento: IndexedDB via `idb-keyval`, chave `vultra.attendance-queue`.
  - Capacidade máxima: `50` operações. Cheia, a operação é recusada com
    `"Fila offline cheia. Reconecte para enviar as correções pendentes."`.
  - Reenvio: em ordem de entrada, quando `navigator.onLine` volta a `true` ou ao abrir o app. Não se
    depende de Background Sync, que não existe em todo navegador alvo.
  - Uma operação que falhe com `4xx` sai da fila e vira notificação de falha; `5xx` e falha de rede são
    reenfileiradas, no máximo `5` tentativas, com espera de `2`, `4`, `8`, `16` e `32` segundos.
  - Enquanto há item na fila, a tela mostra `"N correção(ões) aguardando conexão"` de forma persistente.
- Nada além da correção manual funciona offline. Abrir sessão, fechar sessão e qualquer leitura exigem
  rede, e dizem isso.

### 12. Configuração

Um módulo único, `shared/env/env.ts`, validado por `zod` no boot. Toda variável é obrigatória; **nenhum
valor padrão no ponto de leitura**, em nenhum ambiente (ADR-0001 §6). Faltando variável, o build falha
nomeando-a e o formato esperado.

| Variável | Formato | Lado |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | URL absoluta, sem barra final | Cliente e servidor |
| `NEXT_PUBLIC_APP_URL` | URL absoluta, sem barra final | Cliente e servidor |

Os nove fallbacks atuais — `NEXT_PUBLIC_API_URL` em `middleware.ts`, `auth-client.ts` e `next.config.ts`,
nos três apps — desaparecem junto com os apps.

### 13. Portão de qualidade

Do mais barato ao mais caro, todos exit `0`, zero erro e zero aviso:

```
bun run lint        biome check .
bun run typecheck   tsc --noEmit
bun run test        vitest run
bun run build       next build
bun run test:e2e    playwright test
```

- **Lint é Biome, e só Biome.** `next lint` é removido em vez de configurado: o repositório já decidiu
  Biome para TypeScript, e dois linters sobre o mesmo código é pior que um. As regras específicas do Next
  que se perdem são de otimização de imagem, fonte e script — nenhuma delas é requisito aqui.
- Unidade: Vitest + Testing Library, com **MSW** interceptando na rede, de modo que o cliente de API é
  exercitado de verdade em vez de substituído por dublê.
- E2E: Playwright, projetos `chromium-desktop` (`1280×800`) e `chromium-mobile` (`390×844`, com emulação
  de toque). Todo fluxo crítico roda nos dois.
- Acessibilidade: `axe-core` roda em toda tela dentro do E2E; violação de severidade `serious` ou
  `critical` reprova.
- Sem CI ainda no repositório, o portão roda na máquina de quem desenvolve — a mesma condição do resto.

---

## Perfis e privilégios

| Área / Ação | Papel | Permissão na API |
| --- | --- | --- |
| Membros: ver | `gestor`, `professor` | `members:read` |
| Membros: criar, editar, desativar, importar | `gestor` | `members:manage` |
| Turmas: ver | `gestor`, `professor` (só as próprias) | `classes:read` |
| Turmas: criar, editar, matricular | `gestor` | `classes:manage` |
| Dispositivos: tudo | `gestor` | `devices:manage` |
| Biometria: cadastrar | `gestor` | `biometrics:enroll` |
| Biometria: listar | `gestor` | `biometrics:read` |
| Biometria: revogar | `gestor` | `biometrics:revoke` |
| Chamada: ver | `gestor`, `professor` (só as próprias) | `attendance:read` |
| Chamada: abrir, fechar, corrigir | `gestor`, `professor` (só as próprias) | `attendance:write` |
| Relatório de frequência | `gestor`, `professor` (só as próprias) | `reports:read` |
| Relatório de bem-estar | `gestor`, `rh` | `reports:read` |
| Auditoria | `gestor` | `audit:read` |
| Retenção | `gestor` | `retention:execute` |

O papel `rh` alcança **uma única tela**, `/reports/wellbeing`. Qualquer outra rota responde com a tela de
acesso negado, sem revelar que a rota existe.

---

## Mapa de telas

### Área `(auth)` — pública

| Rota | Tela |
| --- | --- |
| `/login` | Entrar |
| `/accept-invitation/[invitationId]` | Aceitar convite e definir senha |
| `/forgot-password` | Solicitar recuperação |
| `/reset-password` | Definir nova senha |

### Área `(manager)` — `gestor`

`Cadastro` → `Membros` · `Turmas` · `Dispositivos`
`Biometria` → `Perfis biométricos`
`Relatórios` → `Frequência` · `Bem-estar`
`Governança` → `Auditoria` · `Retenção`

| Rota | Tela |
| --- | --- |
| `/members` | Lista de membros |
| `/members/new` · `/members/[memberId]/edit` | Formulário de membro (diálogo sobre a lista) |
| `/member-imports` | Importação em lote e histórico |
| `/classes` | Lista de turmas |
| `/classes/[classId]` | Turma: dados e matrículas |
| `/devices` | Lista de dispositivos |
| `/biometric-profiles` | Perfis biométricos |
| `/biometric-profiles/new` | Cadastro biométrico (captura) |
| `/reports/attendance` | Relatório de frequência |
| `/reports/wellbeing` | Relatório de bem-estar |
| `/audit-logs` | Trilha de auditoria |
| `/retention` | Execução de descarte |

### Área `(teacher)` — `professor`

`Chamada` · `Minhas turmas` · `Frequência`

| Rota | Tela |
| --- | --- |
| `/attendance` | Chamada ao vivo |
| `/classes` | Minhas turmas |
| `/reports/attendance` | Frequência das minhas turmas |

### Área `(hr)` — `rh`

`Bem-estar`

| Rota | Tela |
| --- | --- |
| `/reports/wellbeing` | Bem-estar agregado |

---

## Regras de Negócio

### 1. Guarda de rota e negação por omissão

`shared/auth/guards.ts` declara, para cada rota, o conjunto de papéis permitidos. `middleware.ts` lê a
sessão, resolve o papel e nega qualquer rota sem declaração explícita.

- Sem sessão em rota privada: redireciona para `/login?next=<rota>`.
- Com sessão em rota de outro papel: responde a página de acesso negado, com
  > "Você não tem acesso a esta área."

  e um botão `Ir para o início` que leva à rota inicial do papel.
- Com sessão em `/login`: redireciona para a rota inicial do papel.

### 2. Entrar

Campos: `E-mail` e `Senha`. Envia por `authClient.signIn.email`.

- Credencial inválida:
  > "E-mail ou senha incorretos."
- Conta desativada:
  > "Esta conta está desativada. Procure o gestor da instituição."
- Sucesso: navega para `next` quando presente e pertencente ao papel, senão para a rota inicial do papel.
- Após `5` falhas consecutivas no mesmo e-mail, a API responde `429`; a tela exibe
  > "Muitas tentativas. Tente novamente em N segundos."

  com `N` vindo de `Retry-After`, e o botão fica desabilitado enquanto a contagem corre.

### 3. Convidar membro

Do gestor, na lista de membros, ação `Convidar`. Campos: `E-mail` e `Papel` (`gestor`, `professor`, `rh`).
Envia por `authClient.organization.inviteMember`.

- Sucesso:
  > "Convite enviado para {email}."
- E-mail já convidado e convite ainda válido:
  > "Já existe um convite pendente para este e-mail."
- E-mail já pertencente à instituição:
  > "Este e-mail já tem acesso."

O convite vale `7` dias, prazo declarado pela API.

### 4. Aceitar convite

`/accept-invitation/[invitationId]` é pública. Mostra o nome da instituição e o papel recebido, e pede
`Nome completo`, `Senha` e `Confirmar senha`.

- Senha: mínimo `12` caracteres, com ao menos uma letra e um dígito. Falhando:
  > "A senha precisa ter no mínimo 12 caracteres, com ao menos uma letra e um número."
- Confirmação divergente:
  > "As senhas não conferem."
- Convite expirado, já usado ou inexistente — **os três respondem igual**, para não revelar existência:
  > "Este convite não é mais válido. Peça um novo ao gestor da instituição."
- Sucesso: cria a conta, autentica e navega para a rota inicial do papel, com
  > "Bem-vindo ao Vultra."

### 5. Recuperar senha

`/forgot-password` pede o `E-mail`. A resposta é **sempre a mesma**, exista a conta ou não:

> "Se este e-mail estiver cadastrado, você receberá as instruções em instantes."

`/reset-password` recebe o token por `searchParams`, pede `Senha` e `Confirmar senha` com as mesmas regras
da regra 4, e no sucesso navega para `/login` com

> "Senha alterada. Entre com a nova senha."

### 6. Tratamento de erro da API

Toda tela mapeia o `code` do erro para uma mensagem em PT-BR. `code` desconhecido cai em

> "Não foi possível concluir a operação. Tente novamente."

Todo estado de erro exibe o `correlationId` com um botão `Copiar` e o texto auxiliar
`"Informe este código ao suporte."`. O `message` em inglês vindo do servidor **nunca** é exibido.

Mapa mínimo de códigos:

| `code` | Mensagem exibida |
| --- | --- |
| `INSUFFICIENT_PERMISSIONS` | "Você não tem permissão para esta ação." |
| `INVALID_CURSOR` | "A navegação expirou. Voltando para a primeira página." |
| `MEMBER_EXTERNAL_CODE_CONFLICT` | "Este código externo já está em uso por outro membro ativo." |
| `LIVENESS_CHECK_FAILED` | "A captura não corresponde a uma pessoa presente. Capture novamente, ao vivo." |
| `SESSION_ALREADY_CLOSED` | "Esta sessão de chamada já foi encerrada." |
| `PRECONDITION_FAILED` | "A sessão mudou em outro dispositivo. Recarregando." |
| `INVALID_REPORT_RANGE` | "A data inicial precisa ser anterior à data final." |

### 7. Paginação por cursor

Nenhuma tela exibe total de registros. A navegação é `Anterior` e `Próximo`.

- A URL carrega `cursor` e a pilha de cursores anteriores em `cursorStack`.
- `Próximo` fica desabilitado quando `nextCursor` é `null`. `Anterior` fica desabilitado na primeira página.
- `limit` é `50`, fixo, e não é exposto ao usuário.
- Erro `INVALID_CURSOR` limpa `cursor` e `cursorStack` e recarrega a primeira página, com a mensagem da
  regra 6.
- Trocar filtro, busca ou ordenação zera `cursor` e `cursorStack`.

### 8. Lista de membros

Colunas: `Nome`, `E-mail`, `Papel`, `Código externo`, `Cadastro biométrico`, `Criado em`, `Ações`.

- Filtros: `Papel` (todos, `gestor`, `professor`, `rh`, `student`), `Situação` (ativos, inativos, todos) e
  busca livre por nome ou código externo, com espera de `300` ms após a digitação.
- Ordenação: `Nome` ascendente por padrão, alternável com `Criado em`.
- `Cadastro biométrico` é um selo `Sim` ou `Não`, derivado de `GET /v1/biometric-profiles?memberId=`, em
  uma única requisição por página exibida — nunca uma por linha.
- Vazio com filtro aplicado:
  > "Nenhum membro encontrado com esses filtros."
- Vazio sem filtro:
  > "Nenhum membro cadastrado ainda."

  com o botão `Novo membro`.

### 9. Criar e editar membro

Diálogo sobre a lista. Campos na regra do Dicionário de Dados. Ao salvar, invalida a lista.

- Criação bem-sucedida:
  > "Membro cadastrado."
- Edição bem-sucedida:
  > "Alterações salvas."
- O campo `Papel` só oferece `student` na criação por esta tela; papéis com login nascem por convite
  (regra 3), nunca por cadastro direto — é o que impede criar acesso sem trilha de convite.

### 10. Desativar membro

`alert-dialog` de confirmação, com o texto:

> "Desativar {nome}? O acesso é revogado imediatamente e o cadastro biométrico é apagado. Os registros de
> presença já feitos são mantidos."

- Confirmação: botão `Desativar`, em `--color-danger`. Cancelamento é o botão padrão e recebe o foco
  inicial.
- Sucesso:
  > "Membro desativado."

### 11. Importação em lote

`/member-imports` aceita um arquivo `.csv` de no máximo `500` linhas e `256` KB, com cabeçalho
`fullName,email,role,externalCode`.

- O arquivo é lido no navegador, validado linha a linha contra o mesmo schema `zod` do formulário, e
  enviado como JSON para `POST /v1/member-imports`. **O arquivo em si nunca é enviado.**
- Mais de `500` linhas:
  > "O arquivo tem N linhas. O limite é 500 por importação."
- Cabeçalho divergente:
  > "O cabeçalho precisa ser exatamente: fullName,email,role,externalCode"
- Enviado, a tela acompanha `GET /v1/member-imports/{importId}` a cada `2000` ms até `completed` ou
  `failed`, e exibe a tabela de resultado por linha com `Linha`, `Situação` e `Motivo`.
- Concluída com falha parcial:
  > "Importação concluída: N cadastrados, M com erro."
- O histórico lista as importações dos últimos `7` dias, que é o prazo de retenção declarado.

### 12. Turmas e matrícula

`/classes` lista `Nome`, `Código`, `Professor responsável`, `Matriculados`, `Situação`.

- `Matriculados` é a contagem das matrículas carregadas para a turma, obtida em páginas de `100` até
  esgotar, com teto de `500`. Acima do teto, exibe `"500+"`.
- `/classes/[classId]` tem duas abas: `Dados` e `Matrículas`.
- Matricular: campo de busca de membro com papel `student`, e a matrícula é `PUT` idempotente. Matricular
  quem já está matriculado responde `200` e a tela mostra
  > "Este aluno já está matriculado nesta turma."
- Remover matrícula pede confirmação e avisa:
  > "Remover {nome} da turma? Os registros de presença já feitos são mantidos."
- Para o papel `professor`, a lista traz apenas as próprias turmas e não há ação de criar, editar ou
  matricular.

### 13. Dispositivos e chave em claro

`/devices` lista `Nome`, `Localização`, `Situação`, `Último contato`.

- Registrar e rotacionar chave devolvem a chave em claro **uma única vez**. A tela a exibe em um diálogo
  com botão `Copiar` e o aviso:
  > "Esta chave aparece uma única vez. Copie e guarde agora — ela não pode ser recuperada."
- O diálogo só fecha por ação explícita no botão `Já copiei`. `Escape` e clique fora não fecham, para não
  perder a chave por acidente.
- A chave **nunca** vai para `localStorage`, `sessionStorage`, URL ou log de console.
- Rotacionar pede confirmação:
  > "Rotacionar a chave de {nome}? A câmera para de enviar até ser reconfigurada com a chave nova."

### 14. Cadastro biométrico — origem da captura

`/biometric-profiles/new` oferece **duas origens**, em abas: `Câmera` e `Arquivo`.

A garantia de vivacidade é do servidor, não da origem: o `ai-service` roda `MiniFASNetV2` sobre todo quadro
nos três fluxos (ADR-0002), então uma foto de foto reprova com `SPOOF_DETECTED` venha da webcam ou do
disco. A aba `Arquivo` não enfraquece RF-22 — a webcam também não prova nada por si, já que o cliente
controla os bytes enviados de qualquer forma.

**Aba `Câmera`:**

- `getUserMedia({ video: { facingMode: "user", width: 1280, height: 720 } })`, exibido com guia oval de
  enquadramento.
- Permissão negada:
  > "Sem acesso à câmera. Autorize no navegador ou use a aba Arquivo."
- Nenhuma câmera disponível:
  > "Nenhuma câmera encontrada neste dispositivo."
- Contexto sem HTTPS:
  > "A câmera exige uma conexão segura. Use a aba Arquivo."
- O quadro é extraído em `<canvas>` como JPEG com qualidade `0.92`, convertido para base64 e enviado.
- O `MediaStream` é encerrado ao sair da tela, ao trocar de aba e ao concluir o cadastro. Nenhum quadro é
  guardado em nenhum ponto do cliente.

**Aba `Arquivo`:**

- Aceita `image/jpeg` e `image/png`, no máximo `5` MB de arquivo.
- Antes de enviar, redimensiona no `<canvas>` para largura máxima `1280` px e recodifica em JPEG `0.92`,
  de modo que o resultado respeite o teto de `1048576` bytes de `frameBase64` da SPEC-002.
- Tipo não aceito:
  > "Escolha uma imagem JPEG ou PNG."
- Arquivo maior que `5` MB:
  > "A imagem tem mais de 5 MB. Escolha uma menor."
- O arquivo é lido em memória e descartado após o envio. Não vai para IndexedDB nem para cache.

Em ambas as abas: `Aluno` é obrigatório e escolhido antes da captura, entre membros ativos com papel
`student` e sem perfil biométrico ativo.

### 15. Recusa de quadro no cadastro

`POST /v1/biometric-profiles` responde `422` com o motivo. A tela mostra a mensagem correspondente, mantém
o aluno escolhido e permite nova tentativa sem recarregar.

| `code` | Mensagem exibida |
| --- | --- |
| `LOW_QUALITY_FRAME` | "A imagem está com qualidade insuficiente. Melhore a iluminação e tente de novo." |
| `FACE_NOT_FRONTAL` | "O rosto não está de frente. Olhe diretamente para a câmera." |
| `NO_FACE_DETECTED` | "Nenhum rosto foi encontrado na imagem." |
| `MULTIPLE_FACES_DETECTED` | "Há mais de um rosto na imagem. Enquadre apenas o aluno." |
| `LIVENESS_CHECK_FAILED` | "A captura não corresponde a uma pessoa presente. Capture novamente, ao vivo." |

Sucesso:

> "Cadastro biométrico criado para {nome}."

### 16. Lista e revogação de perfil biométrico

`/biometric-profiles` lista `Aluno`, `Qualidade`, `Versão do modelo`, `Cadastrado em`, `Situação`.

- **Nenhuma imagem, miniatura ou embedding aparece em nenhum ponto da tela.** A API não os devolve, e a
  interface não os reconstrói.
- Revogar pede confirmação:
  > "Revogar o cadastro biométrico de {nome}? O aluno deixa de ser reconhecido pelas câmeras
  > imediatamente. O vetor é inutilizado e apagado em 30 dias."
- Sucesso:
  > "Cadastro biométrico revogado."

### 17. Abrir sessão de chamada

`/attendance` sem sessão aberta mostra o formulário: `Turma` e `Câmera`, ambos obrigatórios.

- `Turma` lista apenas as turmas do professor autenticado, ativas.
- `Câmera` lista apenas os dispositivos ativos da instituição.
- `professorId` **não é enviado** — a API o deriva do responsável pela turma.
- Sucesso: escreve `sessionId` na URL como `?session=<id>` e passa ao painel ao vivo, com
  > "Sessão aberta."
- Já existe sessão aberta para a turma:
  > "Já existe uma sessão aberta para esta turma. Abrindo a sessão existente."

  e a tela navega para ela em vez de falhar.

### 18. Recuperar sessão aberta (RF-13)

Ao abrir `/attendance`, a tela consulta `GET /v1/attendance/sessions?status=open` antes de mostrar o
formulário.

- Havendo exatamente uma sessão aberta do professor: entra direto no painel dela.
- Havendo mais de uma: lista para escolher, com `Turma` e `Aberta às`.
- O `sessionId` vive na URL, então recarregar, trocar de aba ou abrir o mesmo endereço em outro aparelho
  reencontra a mesma sessão.

### 19. Painel ao vivo (RF-11)

O painel mostra **a lista de matriculados da turma**, cada um com estado `Presente` ou `Ausente`, e o
contador `"{presentes} de {matriculados} presentes"`, derivado localmente do cruzamento entre as
matrículas e os registros. Não depende de nenhum campo de total da API.

- Atualização por `GET /v1/attendance/sessions/{sessionId}/records` com `If-None-Match`, a cada `5000` ms.
  `304` não altera a tela e não conta como atividade.
- A aba em segundo plano suspende o polling e o retoma no foco, com uma consulta imediata.
- Quem passa de `Ausente` para `Presente` recebe destaque por `2000` ms e é anunciado em região
  `aria-live="polite"` como `"{nome} presente."`.
- Cada linha mostra o método: selo `Automático` ou `Manual`, e a hora do registro.
- Falha de rede consecutiva por mais de `15000` ms mostra, sem esconder o que já está na tela:
  > "Sem conexão. A chamada continua sendo registrada pela câmera e aparece aqui quando a conexão voltar."
- Sessão fechada em outro dispositivo: o `GET` responde com a sessão fechada, a tela desabilita as ações e
  exibe
  > "Esta sessão foi encerrada em outro dispositivo."

### 20. Correção manual (RF-12)

Da lista do painel, cada linha oferece `Marcar presente` quando ausente, e `Remover presença` quando o
registro é manual.

- `Marcar presente` chama o `PUT` idempotente, com campo opcional `Observação` de até `500` caracteres.
- `Remover presença` só é oferecida para registro `manual`. Registro automático não é removível pela
  interface, e a linha explica:
  > "Registro automático da câmera. Não pode ser removido."
- Remover pede confirmação:
  > "Remover a presença de {nome}? A remoção fica registrada na auditoria."
- Toda correção é otimista na tela e reconciliada pela próxima consulta.

### 21. Fila offline da correção

Sem rede, `Marcar presente` e `Remover presença` entram na fila da seção 11 em vez de falhar.

- A linha afetada ganha o selo `Pendente`.
- A tela mostra, de forma persistente:
  > "{n} correção(ões) aguardando conexão"
- Reenvio bem-sucedido:
  > "Correções pendentes enviadas."
- Item recusado com `4xx` sai da fila e a tela informa, nomeando o aluno:
  > "A correção de {nome} não pôde ser enviada: {mensagem do código}."
- Fechar a aba não descarta a fila; ela persiste em IndexedDB e é reenviada na próxima abertura.

### 22. Fechar sessão

Botão `Encerrar chamada`, com confirmação:

> "Encerrar a chamada de {turma}? Depois disso a câmera para de registrar presença nesta sessão."

- Envia `PATCH` com `If-Match` do `ETag` da última leitura da sessão.
- `412`: recarrega a sessão, mostra a mensagem de `PRECONDITION_FAILED` da regra 6 e pede a confirmação de
  novo. Não reenvia sozinho.
- `409 SESSION_ALREADY_CLOSED`: trata como sucesso do ponto de vista do usuário e mostra a mensagem do
  código, atualizando a tela.
- Sucesso: limpa `?session` da URL e volta ao formulário, com
  > "Chamada encerrada."

### 23. Relatório de frequência (RF-20)

Parâmetros obrigatórios: `Turma`, `De` e `Até`, todos na URL.

- Janela máxima `366` dias. Excedida:
  > "O período não pode passar de 366 dias."
- `De` posterior a `Até` é bloqueado antes do envio, com a mensagem de `INVALID_REPORT_RANGE`.
- Tabela por aluno: `Aluno`, `Presenças`, `Faltas`, `Frequência`. Percentual com uma casa decimal.
- Para o papel `professor`, o seletor de turma traz apenas as próprias.
- Exportar `.csv` gera o arquivo no navegador a partir do dado já carregado, com nome
  `frequencia-{codigo-da-turma}-{de}-{ate}.csv`. Nenhuma rota de exportação é chamada.

### 24. Relatório de bem-estar (RF-18, RNF-05)

Parâmetros: `Turma` opcional, `Professor` opcional, `De` e `Até` obrigatórios.

- Exibe a distribuição dos sete rótulos afetivos em gráfico de barras empilhadas, por recorte.
- Recorte com `suppressed: true` aparece na tabela com os valores substituídos por `—` e a nota:
  > "Recorte com menos de 5 registros. Suprimido para não identificar alunos."
- **Nenhuma tela exibe rótulo afetivo de aluno identificável, em nenhum recorte.** A interface não tem
  caminho para isso, porque a API não devolve o dado individual.
- O papel `rh` vê esta tela e nenhuma outra; a navegação dele tem um único item.
- Enquanto a análise afetiva não estiver implementada no `ai-service`, a tela mostra o estado vazio:
  > "Ainda não há dados de bem-estar no período."

### 25. Auditoria (RNF-04)

`/audit-logs` lista `Quando`, `Quem`, `Ação`, `Recurso`, `IP`.

- Filtros: `Ação`, `Tipo de recurso`, `Ator`, `De`, `Até`. Ordenação fixa por `Quando`, descendente.
- Detalhe da linha abre um painel com o `payload` formatado.
- **A tela é somente leitura.** Não existe ação de editar nem de apagar, e nenhuma requisição de escrita
  parte daqui.
- Vazio:
  > "Nenhum registro de auditoria com esses filtros."

### 26. Retenção (RNF-03)

`/retention` mostra a tabela de prazos declarados pela SPEC-002 e um botão `Executar descarte`, com
confirmação:

> "Executar o descarte agora? Os dados vencidos são apagados definitivamente e a operação fica registrada
> na auditoria."

- Resultado:
  > "Descarte concluído: {n} registro(s) apagado(s)."
- Quando a resposta indica que o teto de `10000` linhas foi atingido:
  > "O limite de 10000 registros por execução foi atingido. Execute novamente para continuar."

### 27. Cota estourada

Qualquer `429` mostra, sem limpar a tela:

> "Muitas requisições. Tente novamente em N segundos."

com `N` de `Retry-After`, e desabilita a ação que disparou até a contagem terminar.

---

## Dicionário de Dados de Tela

**Origem dos campos de leitura.** Coluna de tabela, selo e valor exibido sem edição têm tipo, formato e
origem definidos pelo recurso correspondente da SPEC-002; esta spec declara apenas quais campos a tela
mostra, em que ordem e com que rótulo em PT-BR. As tabelas abaixo cobrem os campos **de entrada**, que são
os que a interface valida antes de enviar.

### Formulário de membro

| Nome do Campo | Tipo | Habilitado | Obrigatório | Regra / Validação |
| --- | --- | --- | --- | --- |
| `Nome completo` | Texto (200) | Sim | Sim | `2` a `200` caracteres |
| `E-mail` | Texto (254) | Sim | Não | Formato de e-mail; vazio envia `null` |
| `Papel` | Dropdown | Condicional (só `student` nesta tela) | Sim | Valor fixo `student`; papéis com login nascem por convite |
| `Código externo` | Texto (50) | Sim | Não | `1` a `50` caracteres; único entre membros ativos do tenant |

### Formulário de convite

| Nome do Campo | Tipo | Habilitado | Obrigatório | Regra / Validação |
| --- | --- | --- | --- | --- |
| `E-mail` | Texto (254) | Sim | Sim | Formato de e-mail |
| `Papel` | Dropdown | Sim | Sim | `gestor`, `professor` ou `rh`, rotulados `Gestor`, `Professor`, `RH` |

### Formulário de turma

| Nome do Campo | Tipo | Habilitado | Obrigatório | Regra / Validação |
| --- | --- | --- | --- | --- |
| `Nome` | Texto (120) | Sim | Sim | `2` a `120` caracteres |
| `Código` | Texto (32) | Sim | Sim | `1` a `32` caracteres; único no tenant |
| `Professor responsável` | Dropdown com busca | Sim | Sim | Membros ativos com papel `professor`, ordenados por nome |

### Formulário de dispositivo

| Nome do Campo | Tipo | Habilitado | Obrigatório | Regra / Validação |
| --- | --- | --- | --- | --- |
| `Nome` | Texto (120) | Sim | Sim | `2` a `120` caracteres |
| `Localização` | Texto (200) | Sim | Não | Até `200` caracteres |

### Cadastro biométrico

| Nome do Campo | Tipo | Habilitado | Obrigatório | Regra / Validação |
| --- | --- | --- | --- | --- |
| `Aluno` | Dropdown com busca | Sim | Sim | Membros ativos, papel `student`, sem perfil biométrico ativo |
| `Origem` | Abas | Sim | Sim | `Câmera` ou `Arquivo`; padrão `Câmera` |
| `Arquivo` | Arquivo | Condicional (aba `Arquivo`) | Condicional | `image/jpeg` ou `image/png`, até `5` MB |

### Abrir sessão de chamada

| Nome do Campo | Tipo | Habilitado | Obrigatório | Regra / Validação |
| --- | --- | --- | --- | --- |
| `Turma` | Dropdown | Sim | Sim | Turmas ativas do professor autenticado |
| `Câmera` | Dropdown | Sim | Sim | Dispositivos ativos do tenant |

### Correção manual

| Nome do Campo | Tipo | Habilitado | Obrigatório | Regra / Validação |
| --- | --- | --- | --- | --- |
| `Observação` | Texto (500) | Sim | Não | Até `500` caracteres |

### Relatório de frequência

| Nome do Campo | Tipo | Habilitado | Obrigatório | Regra / Validação |
| --- | --- | --- | --- | --- |
| `Turma` | Dropdown | Sim | Sim | Escopo do papel; `professor` vê só as próprias |
| `De` | Data | Sim | Sim | Não posterior a `Até`; janela até `366` dias |
| `Até` | Data | Sim | Sim | Não anterior a `De`; não futura |

### Relatório de bem-estar

| Nome do Campo | Tipo | Habilitado | Obrigatório | Regra / Validação |
| --- | --- | --- | --- | --- |
| `Turma` | Dropdown | Sim | Não | Vazio agrega todas as turmas do escopo |
| `Professor` | Dropdown | Sim | Não | Vazio agrega todos os professores do escopo |
| `De` | Data | Sim | Sim | Não posterior a `Até` |
| `Até` | Data | Sim | Sim | Não anterior a `De`; não futura |

---

## Ações de Tela

| Nome da Ação | Destino / Ação | Regra de Ativação | Mensagens Associadas |
| --- | --- | --- | --- |
| `Entrar` | `authClient.signIn.email` | Campos válidos e sem bloqueio por cota | Erro: "E-mail ou senha incorretos." |
| `Convidar` | Diálogo de convite | Papel `gestor` | Sucesso: "Convite enviado para {email}." |
| `Novo membro` | Diálogo de membro | Papel `gestor` | Sucesso: "Membro cadastrado." |
| `Salvar` | `PATCH /v1/members/{id}` | Formulário alterado e válido | Sucesso: "Alterações salvas." |
| `Desativar` | `DELETE /v1/members/{id}` | Membro ativo, papel `gestor` | Sucesso: "Membro desativado." |
| `Importar` | `POST /v1/member-imports` | Arquivo válido e dentro dos limites | Sucesso: "Importação concluída: N cadastrados, M com erro." |
| `Matricular` | `PUT /v1/classes/{id}/enrollments/{memberId}` | Papel `gestor`, aluno escolhido | Sucesso: "Aluno matriculado." · Já matriculado: "Este aluno já está matriculado nesta turma." |
| `Registrar câmera` | `POST /v1/devices` | Papel `gestor` | Sucesso: diálogo da chave em claro |
| `Rotacionar chave` | `POST /v1/devices/{id}/keys` | Papel `gestor`, dispositivo ativo | Sucesso: diálogo da chave em claro |
| `Capturar` | `POST /v1/biometric-profiles` | Aluno escolhido e quadro disponível | Sucesso: "Cadastro biométrico criado para {nome}." |
| `Revogar` | `DELETE /v1/biometric-profiles/{id}` | Papel `gestor`, perfil ativo | Sucesso: "Cadastro biométrico revogado." |
| `Abrir chamada` | `POST /v1/attendance/sessions` | Turma e câmera escolhidas | Sucesso: "Sessão aberta." |
| `Marcar presente` | `PUT .../records/{memberId}` | Sessão aberta e aluno ausente | Offline: entra na fila com selo `Pendente` |
| `Remover presença` | `DELETE .../records/{memberId}` | Registro de método `manual` | Confirmação obrigatória |
| `Encerrar chamada` | `PATCH /v1/attendance/sessions/{id}` | Sessão aberta | Sucesso: "Chamada encerrada." |
| `Executar descarte` | `POST /v1/retention-runs` | Papel `gestor` | Sucesso: "Descarte concluído: {n} registro(s) apagado(s)." |
| `Exportar CSV` | Gera arquivo no navegador | Relatório carregado com ao menos uma linha | — |
| `Copiar` | Copia `correlationId` ou chave para a área de transferência | Sempre, quando o valor existe | Sucesso: "Copiado." |
| `Tentar de novo` | Refaz a consulta que falhou | Estado de erro | — |
| `Sair` | `authClient.signOut` | Sessão ativa | Navega para `/login` |

---

## Cenários de Aceite (Gherkin)

### Cenário 1 — Entrar e chegar na área do papel (caminho feliz)

```gherkin
Dado que existe um usuário ativo com papel professor
Quando ele envia e-mail e senha corretos em /login
Então a sessão é criada
E o navegador vai para /attendance
E nenhuma rota do grupo (manager) é alcançável por ele
```

### Cenário 2 — Rota sem declaração de papel é negada

```gherkin
Dado uma rota privada que não consta em shared/auth/guards.ts
Quando um usuário autenticado com qualquer papel a acessa
Então a resposta é a tela de acesso negado
E a mensagem é "Você não tem acesso a esta área."
```

### Cenário 3 — Sem sessão em rota privada

```gherkin
Dado que não existe sessão no navegador
Quando /members é acessada
Então o navegador vai para /login?next=/members
E após entrar com papel gestor o navegador vai para /members
```

### Cenário 4 — Papel rh alcança uma única tela

```gherkin
Dado um usuário autenticado com papel rh
Quando ele acessa /members
Então a resposta é a tela de acesso negado
E a navegação lateral tem exatamente um item
E /reports/wellbeing é servida normalmente
```

### Cenário 5 — Sessão expirada durante o uso

```gherkin
Dado um usuário na lista de membros
Quando qualquer requisição responde 401
Então o cache do TanStack Query é limpo
E o navegador vai para /login?next=/members
E a mensagem "Sua sessão expirou. Entre novamente." é exibida
```

### Cenário 6 — Credencial inválida

```gherkin
Dado a tela /login
Quando a senha enviada está incorreta
Então a mensagem é "E-mail ou senha incorretos."
E o campo de senha é limpo
E o foco volta para o campo de senha
```

### Cenário 7 — Bloqueio por cota no login

```gherkin
Dado que a API responde 429 com Retry-After igual a 42
Quando o formulário de login é enviado
Então a mensagem é "Muitas tentativas. Tente novamente em 42 segundos."
E o botão Entrar fica desabilitado até a contagem terminar
```

### Cenário 8 — Convidar membro

```gherkin
Dado um gestor na lista de membros
Quando ele convida "vitor@exemplo.br" com papel professor
Então a mensagem é "Convite enviado para vitor@exemplo.br."
E o formulário de membro nunca oferece os papéis gestor, professor ou rh
```

### Cenário 9 — Aceitar convite e definir senha

```gherkin
Dado um convite válido para papel professor
Quando o convidado informa nome, senha de 12 caracteres com letra e número, e a confirmação igual
Então a conta é criada e autenticada
E o navegador vai para /attendance
E a mensagem é "Bem-vindo ao Vultra."
```

### Cenário 10 — Convite inválido não revela existência

```gherkin
Dado um identificador de convite expirado, um já usado e um inexistente
Quando cada um é aberto
Então os três exibem exatamente "Este convite não é mais válido. Peça um novo ao gestor da instituição."
E nenhuma diferença de texto, status ou tempo distingue os três casos
```

### Cenário 11 — Recuperação não revela cadastro

```gherkin
Dado a tela /forgot-password
Quando um e-mail cadastrado e um não cadastrado são enviados
Então os dois exibem "Se este e-mail estiver cadastrado, você receberá as instruções em instantes."
```

### Cenário 12 — Erro da API exibe código de correlação

```gherkin
Dado que uma requisição falha com code INSUFFICIENT_PERMISSIONS e correlationId conhecido
Quando o estado de erro é exibido
Então o texto é "Você não tem permissão para esta ação."
E o correlationId aparece com um botão Copiar
E a prosa em inglês vinda do servidor não aparece em nenhum lugar da tela
```

### Cenário 13 — Código de erro desconhecido

```gherkin
Dado que a API responde com um code que o cliente não mapeia
Quando o estado de erro é exibido
Então o texto é "Não foi possível concluir a operação. Tente novamente."
E o correlationId continua visível
```

### Cenário 14 — Paginação por cursor

```gherkin
Dado uma lista cuja primeira página traz nextCursor não nulo
Quando Próximo é acionado
Então a URL passa a carregar cursor e cursorStack
E Anterior fica habilitado
E nenhuma contagem total aparece na tela
```

### Cenário 15 — Cursor inválido volta para a primeira página

```gherkin
Dado uma URL com cursor expirado
Quando a lista é carregada
Então a API responde INVALID_CURSOR
E a mensagem é "A navegação expirou. Voltando para a primeira página."
E cursor e cursorStack saem da URL
E a primeira página é exibida
```

### Cenário 16 — Filtro e busca vivem na URL

```gherkin
Dado a lista de membros
Quando o papel professor é filtrado e "silva" é buscado
Então a URL carrega role=professor e search=silva
E recarregar a página reconstrói o mesmo resultado
E o histórico do navegador não ganha uma entrada por tecla digitada
```

### Cenário 17 — Os quatro estados sem deslocamento de layout

```gherkin
Dado a lista de membros carregando
Então o esqueleto ocupa exatamente a altura da tabela final
Quando o dado chega
Então nenhum elemento da página muda de posição
E o Cumulative Layout Shift medido é 0
```

### Cenário 18 — Estado vazio distingue filtro de ausência

```gherkin
Dado que a instituição não tem membro nenhum
Então a mensagem é "Nenhum membro cadastrado ainda." com o botão Novo membro
Dado que existem membros mas o filtro não retorna nada
Então a mensagem é "Nenhum membro encontrado com esses filtros."
```

### Cenário 19 — Selo de cadastro biométrico sem N+1

```gherkin
Dado uma página de 50 membros
Quando a lista é carregada
Então a coluna Cadastro biométrico é preenchida
E o número de requisições a /v1/biometric-profiles é exatamente 1
```

### Cenário 20 — Código externo em conflito

```gherkin
Dado um membro ativo com código externo "2026001"
Quando outro membro é criado com o mesmo código
Então a mensagem é "Este código externo já está em uso por outro membro ativo."
E o diálogo permanece aberto com os dados preenchidos
```

### Cenário 21 — Desativar membro

```gherkin
Dado um gestor na lista de membros
Quando ele aciona Desativar em um membro
Então um alert-dialog pede confirmação nomeando o membro
E o botão Cancelar recebe o foco inicial
E Escape fecha sem desativar
Quando ele confirma
Então a mensagem é "Membro desativado."
```

### Cenário 22 — Importação recusa arquivo acima do limite

```gherkin
Dado um CSV com 501 linhas de dados
Quando o arquivo é escolhido
Então a mensagem é "O arquivo tem 501 linhas. O limite é 500 por importação."
E nenhuma requisição é enviada
```

### Cenário 23 — Importação parcial mostra o resultado por linha

```gherkin
Dado um CSV de 10 linhas em que 2 têm e-mail inválido
Quando a importação conclui
Então a mensagem é "Importação concluída: 8 cadastrados, 2 com erro."
E a tabela mostra a linha e o motivo de cada uma das 2 falhas
```

### Cenário 24 — Matrícula idempotente

```gherkin
Dado um aluno já matriculado em uma turma
Quando o gestor o matricula de novo
Então a resposta é 200
E a mensagem é "Este aluno já está matriculado nesta turma."
E a contagem de matriculados não muda
```

### Cenário 25 — Professor não gerencia turma

```gherkin
Dado um usuário com papel professor em /classes
Então apenas as turmas em que ele é responsável aparecem
E não existe botão de criar, editar ou matricular na tela
E acessar /classes de uma turma alheia responde a tela de acesso negado
```

### Cenário 26 — Chave de dispositivo aparece uma única vez

```gherkin
Dado um gestor registrando uma câmera
Quando a API responde 201 com a chave em claro
Então o diálogo exibe a chave com botão Copiar e o aviso de que ela não pode ser recuperada
E Escape e clique fora não fecham o diálogo
E após fechar por Já copiei a chave não aparece em nenhuma leitura posterior
E a chave não é gravada em localStorage, sessionStorage nem na URL
```

### Cenário 27 — Cadastro biométrico pela câmera

```gherkin
Dado um gestor em /biometric-profiles/new com a aba Câmera e um aluno escolhido
Quando ele captura e a API responde 201
Então a mensagem é "Cadastro biométrico criado para {nome}."
E o MediaStream é encerrado
E nenhum quadro permanece em memória, IndexedDB ou cache
```

### Cenário 28 — Cadastro biométrico por arquivo

```gherkin
Dado um gestor na aba Arquivo com um JPEG de 4 MB e 4000 px de largura
Quando ele envia
Então a imagem é reduzida para no máximo 1280 px de largura antes do envio
E o frameBase64 enviado tem no máximo 1048576 bytes
E a mesma verificação de vivacidade do servidor se aplica
```

### Cenário 29 — Arquivo de tipo não aceito

```gherkin
Dado a aba Arquivo
Quando um PDF é escolhido
Então a mensagem é "Escolha uma imagem JPEG ou PNG."
E nenhuma requisição é enviada
```

### Cenário 30 — Quadro recusado por vivacidade

```gherkin
Dado uma captura de uma foto exibida em tela de celular
Quando ela é enviada em qualquer das duas abas
Então a API responde 422 com LIVENESS_CHECK_FAILED
E a mensagem é "A captura não corresponde a uma pessoa presente. Capture novamente, ao vivo."
E o aluno escolhido permanece selecionado para nova tentativa
```

### Cenário 31 — Permissão de câmera negada

```gherkin
Dado que o navegador nega o acesso à câmera
Quando a aba Câmera é aberta
Então a mensagem é "Sem acesso à câmera. Autorize no navegador ou use a aba Arquivo."
E a aba Arquivo permanece utilizável
```

### Cenário 32 — Perfil biométrico nunca expõe imagem

```gherkin
Dado a lista /biometric-profiles com perfis cadastrados
Então nenhuma miniatura, imagem ou vetor aparece na tela
E o HTML renderizado não contém nenhum campo de embedding
```

### Cenário 33 — Revogar cadastro biométrico

```gherkin
Dado um gestor na lista de perfis biométricos
Quando ele revoga um perfil e confirma
Então a mensagem é "Cadastro biométrico revogado."
E o perfil passa a aparecer como revogado
```

### Cenário 34 — Abrir sessão sem enviar professorId

```gherkin
Dado um professor em /attendance sem sessão aberta
Quando ele escolhe turma e câmera e abre a chamada
Então o corpo enviado contém apenas classId e deviceId
E a URL passa a carregar ?session=<id>
E a mensagem é "Sessão aberta."
```

### Cenário 35 — Recuperar sessão aberta após recarregar

```gherkin
Dado um professor com uma sessão aberta
Quando ele recarrega /attendance sem o parâmetro session
Então GET /v1/attendance/sessions?status=open é consultado antes do formulário
E o painel da sessão existente é exibido diretamente
E abrir o mesmo endereço em outro aparelho mostra a mesma sessão
```

### Cenário 36 — Painel ao vivo com polling condicional

```gherkin
Dado um painel de chamada aberto
Quando 5000 ms passam e não há registro novo
Então a requisição envia If-None-Match
E a resposta é 304 sem corpo
E nada na tela muda
```

### Cenário 37 — Aluno passa a presente

```gherkin
Dado um aluno ausente no painel
Quando a consulta seguinte traz o registro dele
Então a linha é destacada por 2000 ms
E a região aria-live anuncia "{nome} presente."
E o contador passa de "3 de 20 presentes" para "4 de 20 presentes"
```

### Cenário 38 — Contador não depende de total da API

```gherkin
Dado uma turma com 20 matriculados
Quando o painel é carregado
Então as matrículas são obtidas em páginas de 100 até esgotar
E o contador é derivado localmente
E nenhuma resposta da API precisa conter um campo total
```

### Cenário 39 — Registro automático não é removível

```gherkin
Dado um registro com recognitionMethod igual a automatic
Então a linha não oferece Remover presença
E o texto "Registro automático da câmera. Não pode ser removido." é exibido
```

### Cenário 40 — Correção manual offline entra na fila

```gherkin
Dado um painel de chamada aberto e o navegador sem rede
Quando o professor marca um aluno como presente
Então a operação entra na fila em IndexedDB
E a linha ganha o selo Pendente
E a tela mostra "1 correção(ões) aguardando conexão"
```

### Cenário 41 — Fila é reenviada quando a rede volta

```gherkin
Dado 3 correções na fila offline
Quando navigator.onLine passa a true
Então as 3 são reenviadas na ordem de entrada
E a mensagem é "Correções pendentes enviadas."
E a fila fica vazia
```

### Cenário 42 — Fila persiste ao fechar a aba

```gherkin
Dado 2 correções na fila offline
Quando a aba é fechada e o app é reaberto sem rede
Então as 2 continuam na fila
E a tela mostra "2 correção(ões) aguardando conexão"
```

### Cenário 43 — Item recusado sai da fila

```gherkin
Dado uma correção na fila para uma sessão que foi encerrada
Quando a rede volta e o reenvio responde 409 SESSION_ALREADY_CLOSED
Então o item sai da fila
E a mensagem nomeia o aluno e o motivo
E nenhuma nova tentativa é feita para esse item
```

### Cenário 44 — Fila cheia recusa a operação

```gherkin
Dado 50 correções já na fila offline
Quando o professor tenta uma 51ª correção
Então a mensagem é "Fila offline cheia. Reconecte para enviar as correções pendentes."
E a fila continua com 50 itens
```

### Cenário 45 — Fechar sessão com If-Match obsoleto

```gherkin
Dado um professor encerrando a chamada com um ETag antigo
Quando a API responde 412
Então a mensagem é "A sessão mudou em outro dispositivo. Recarregando."
E a sessão é recarregada
E a requisição não é reenviada automaticamente
```

### Cenário 46 — Fechar sessão já fechada

```gherkin
Dado uma sessão encerrada em outro dispositivo
Quando o professor aciona Encerrar chamada
Então a API responde 409 SESSION_ALREADY_CLOSED
E a mensagem é "Esta sessão de chamada já foi encerrada."
E a tela volta ao formulário de abrir chamada
```

### Cenário 47 — Perda de conexão no painel não esconde o dado

```gherkin
Dado um painel com 12 presenças exibidas
Quando a rede falha por mais de 15000 ms
Então as 12 presenças continuam visíveis
E a mensagem "Sem conexão. A chamada continua sendo registrada pela câmera e aparece aqui quando a conexão voltar." é exibida
```

### Cenário 48 — Período de relatório inválido

```gherkin
Dado o relatório de frequência com De posterior a Até
Quando o formulário é enviado
Então a mensagem é "A data inicial precisa ser anterior à data final."
E nenhuma requisição é enviada
```

### Cenário 49 — Janela máxima do relatório

```gherkin
Dado um período de 400 dias
Quando o relatório é solicitado
Então a mensagem é "O período não pode passar de 366 dias."
E nenhuma requisição é enviada
```

### Cenário 50 — Exportação acontece no navegador

```gherkin
Dado um relatório de frequência carregado
Quando Exportar CSV é acionado
Então o arquivo é gerado a partir do dado já em memória
E nenhuma requisição adicional é enviada à API
E o nome do arquivo segue frequencia-{codigo-da-turma}-{de}-{ate}.csv
```

### Cenário 51 — Recorte suprimido no bem-estar

```gherkin
Dado um recorte com suppressed igual a true
Quando o relatório de bem-estar é exibido
Então os valores do recorte aparecem como travessão
E a nota "Recorte com menos de 5 registros. Suprimido para não identificar alunos." é exibida
E nenhum rótulo afetivo de aluno identificável aparece em nenhum ponto da tela
```

### Cenário 52 — Auditoria é somente leitura

```gherkin
Dado um gestor em /audit-logs
Então nenhuma ação de editar ou apagar existe na tela
E nenhuma requisição de escrita parte desta rota
```

### Cenário 53 — Descarte atinge o teto

```gherkin
Dado que a execução do descarte apaga 10000 registros
Quando a resposta chega
Então a mensagem é "O limite de 10000 registros por execução foi atingido. Execute novamente para continuar."
```

### Cenário 54 — Cota estourada em qualquer tela

```gherkin
Dado que a API responde 429 com Retry-After igual a 30
Quando uma ação é acionada
Então a mensagem é "Muitas requisições. Tente novamente em 30 segundos."
E o conteúdo já carregado permanece na tela
E a ação fica desabilitada por 30 segundos
```

### Cenário 55 — Tema segue o sistema por padrão

```gherkin
Dado um navegador com prefers-color-scheme dark e nenhuma escolha salva
Quando qualquer tela é aberta
Então o tema escuro é aplicado antes da primeira pintura
E nenhuma piscada de tema claro ocorre
Quando o usuário escolhe o tema claro
Então a escolha persiste em localStorage na chave vultra.theme
E sobrevive a recarregar a página
```

### Cenário 56 — Contraste nos dois temas

```gherkin
Dado o conjunto de tokens de cor
Quando o contraste de cada par de texto e fundo é medido
Então todos atingem no mínimo 4.5:1 no tema claro
E todos atingem no mínimo 4.5:1 no tema escuro
```

### Cenário 57 — Nenhuma tela rola horizontalmente em 390 px

```gherkin
Dado a largura de viewport de 390 px com emulação de toque
Quando cada rota do mapa de telas é aberta
Então o body não rola horizontalmente em nenhuma delas
E toda tabela rola dentro do próprio container
```

### Cenário 58 — Diálogo é operável por teclado

```gherkin
Dado qualquer diálogo da aplicação
Quando ele abre
Então o foco entra nele e não escapa por Tab
E Escape fecha, exceto no diálogo da chave de dispositivo
E ao fechar o foco volta ao elemento que o abriu
```

### Cenário 59 — Nenhuma violação de acessibilidade séria

```gherkin
Dado o conjunto de rotas do mapa de telas
Quando axe-core é executado em cada uma nos dois temas
Então nenhuma violação de severidade serious ou critical é encontrada
```

### Cenário 60 — Nenhuma cor crua fora dos tokens

```gherkin
Dado o código-fonte de src/app e src/modules
Quando ele é varrido por classes de cor literais do Tailwind
Então nenhuma ocorrência de bg-white, text-gray-900, bg-blue-600 ou equivalente é encontrada
E toda cor vem de um token declarado em globals.css
```

### Cenário 61 — Variável de ambiente ausente derruba o build

```gherkin
Dado que NEXT_PUBLIC_API_URL não está definida
Quando o build é executado
Então ele falha
E a mensagem nomeia NEXT_PUBLIC_API_URL e o formato esperado
E nenhum arquivo fora de shared/env/env.ts lê process.env
```

### Cenário 62 — Service worker não cacheia resposta de API

```gherkin
Dado o service worker registrado
Quando qualquer requisição para /v1/ é feita
Então nenhuma resposta dela entra no cache do service worker
E apenas o app shell é cacheado
```

### Cenário 63 — Sair descarta o estado do usuário

```gherkin
Dado um usuário autenticado com listas já carregadas em cache
Quando ele aciona Sair
Então authClient.signOut é chamado
E queryClient.clear() é executado antes do redirecionamento
E o navegador vai para /login
E nenhuma resposta do usuário anterior é servida do cache ao próximo login
```

---

## Fora de Escopo

- **Interface de aluno.** RF-02 fixou que o aluno não autentica; o Vultra é ferramenta de gestão interna.
- **Entrega do dado agregado ao sistema de RH de terceiros (RF-19).** O canal continua aberto em Q-02, e a
  tela de bem-estar existe para o papel `rh` dentro do Vultra, não como integração.
- **Passkeys.** O plugin não está habilitado na versão de Better Auth em uso, e senha com convite cobre a
  entrega de dezembro de 2026.
- **Troca de instituição na interface.** O plugin `organization` suporta múltiplas organizações por
  usuário, mas nenhum requisito pede isso; a organização ativa é a única do usuário.
- **Modo offline além da correção manual.** Abrir sessão, cadastrar biometria e qualquer leitura exigem
  rede. Enfileirar leitura não faz sentido e enfileirar abertura de sessão criaria sessões fantasma.
- **Background Sync.** Não existe em todo navegador alvo; o reenvio é do próprio app.
- **Internacionalização.** A interface é PT-BR apenas, conforme `CLAUDE.md`.
- **Tela de configuração da instituição.** Nenhum requisito descreve o que ela conteria.
- **Notificação por push.** Nenhum requisito pede.
- **Cabeçalhos de segurança da resposta HTTP** — CSP, HSTS, `X-Frame-Options`, `Referrer-Policy` — e
  configuração de cookie de sessão. Continuam na issue #17, que trata o assunto no repositório inteiro e
  não só no portal; resolver metade aqui deixaria a outra metade órfã.
- **Tela de saúde das dependências.** `requirements.md` já decidiu, no log de 2026-08-15, que o painel de
  saúde do serviço de inferência sai da interface de produto e vira observabilidade de servidor.
  `GET /v1/health/dependencies` continua existindo na API, restrita ao `gestor`, e é consumida por quem
  opera o servidor — não por uma tela.
- **Storybook e documentação visual de componentes.** Dois desenvolvedores e uma entrega em dezembro; o
  custo de manter não se paga.
- **Adoção de `packages/types` pelo `api-core`.** Ele hoje declara os próprios schemas TypeBox; unificar é
  trabalho da API, não desta spec.
- **Envio de e-mail.** As regras 3, 4 e 5 dependem de um provedor de e-mail configurado no `api-core`, que
  hoje não existe (`sendInvitationEmail` não está declarado no plugin `organization`). Isso é dependência
  de API e vira issue no epic de identidade da SPEC-002, não task desta spec.
- **Literais `gestor` e `rh` como valor de papel.** São identificadores em PT no contrato público, mesma
  dívida que `POSSÍVEL`. Corrigi-los é mudança de contrato da API, não da interface; fica registrado como
  dívida a corrigir junto com a SPEC-002.

---

## Quebra em Epics e Tasks

Cinco epics. **F1 é pré-requisito de todos os outros**: nenhuma tela existe antes da fundação.

### Epic F1 — Fundação do app único

| # | Issue | Título | Escopo | Critério de aceite | Depende de |
| --- | --- | --- | --- | --- | --- |
| 1 | #114 | Create the single web app and remove the three portals | `apps/web/` criado; `frontend-admin`, `frontend-rh`, `frontend-professores` removidos; os 19 arquivos de `docs/frontend/` que descrevem os três portais removidos; `next` atualizado para além de `15.3.3` | Estrutura da seção 1; `bun run build` verde; nenhum dos três diretórios antigos existe; nenhum documento em `docs/` descreve app que não existe | — |
| 2 | #115 | Configure Tailwind v4 with a PostCSS config | `postcss.config.mjs`, `globals.css` | Uma classe utilitária aplica estilo no navegador; hoje nenhuma aplica | 1 |
| 3 | #116 | Declare design tokens and the three-state theme | `globals.css`, `shared/ui/theme-*` | Cenários 55, 56, 60 | 2 |
| 4 | #117 | Add a single env module validated at boot | `shared/env/env.ts` | Cenário 61 | 1 |
| 5 | #118 | Add the API client with correlation id and error mapping | `shared/api/http.ts`, `shared/api/errors.ts` | Cenários 12, 13, 54 | 4 |
| 6 | #119 | Rewrite `packages/types` against SPEC-002 | `packages/types/src/**` | Envelope com `items`/`page`, erro com `code`/`correlationId`, rotas biométricas novas, `MemberRole` sem `admin`; nenhum tipo com `total` sobrevive | 1 |
| 7 | #120 | Install the shadcn/ui primitives | `shared/ui/**`, `components.json` | Os 18 primitivos da seção 4 presentes; Cenário 58 | 3 |
| 8 | #121 | Add the URL-state hooks and cursor pagination | `shared/url-state/**` | Cenários 14, 15, 16 | 5 |
| 9 | #122 | Add the four async states with zero layout shift | `shared/ui/async-boundary`, `skeleton` composições | Cenários 17, 18 | 7 |
| 10 | #123 | Replace `next lint` with Biome | `biome.json`, `package.json` | `bun run lint` executa Biome e sai 0; `next lint` não existe mais | 1 |
| 11 | #124 | Add Vitest, Testing Library and MSW | `vitest.config.ts`, `src/test/**` | `bun run test` verde com ao menos um teste do cliente de API contra MSW | 5, 10 |
| 12 | #125 | Add Playwright with desktop and mobile projects | `playwright.config.ts`, `e2e/**` | Projetos `chromium-desktop` e `chromium-mobile`; Cenário 57 | 11 |
| 13 | #126 | Add axe-core to the E2E suite | `e2e/accessibility.spec.ts` | Cenário 59 | 12 |
| 14 | #127 | Add the PWA manifest and the app-shell service worker | `public/manifest.webmanifest`, Serwist | Cenário 62; app instalável | 1 |

### Epic F2 — Acesso, sessão e navegação

| # | Issue | Título | Escopo | Critério de aceite | Depende de |
| --- | --- | --- | --- | --- | --- |
| 15 | #128 | Add the route guard map with deny-by-default | `shared/auth/guards.ts`, `middleware.ts` | Cenários 2, 3, 4; matcher sem chamada de rede em asset | 5, 7 |
| 16 | #129 | Build the sign-in screen | `app/(auth)/login/**` | Cenários 1, 6, 7 | 15 |
| 17 | #130 | Handle session expiry and sign-out cache disposal | `shared/api/http.ts`, `shared/auth/**` | Cenários 5, 63 | 16 |
| 18 | #131 | Build the area shells and navigation | `app/(manager)`, `app/(teacher)`, `app/(hr)` layouts | Mapa de telas; navegação em `sheet` abaixo de 768 px; Cenário 4 | 15 |
| 19 | #132 | Build the invitation flow | Diálogo de convite, `app/(auth)/accept-invitation/**` | Cenários 8, 9, 10 | 16 |
| 20 | #133 | Build password recovery | `app/(auth)/forgot-password`, `reset-password` | Cenário 11 | 16 |

### Epic F3 — Cadastro do gestor

| # | Issue | Título | Escopo | Critério de aceite | Depende de |
| --- | --- | --- | --- | --- | --- |
| 21 | #134 | Build the members list | `modules/members/**`, `app/(manager)/members` | Cenários 18, 19 | 8, 9, 18 |
| 22 | #135 | Build the member create and edit dialog | `modules/members/components/member-form` | Cenário 20; papel fixo `student` | 21 |
| 23 | #136 | Build member deactivation | `modules/members/components/deactivate-*` | Cenário 21 | 21 |
| 24 | #137 | Build the bulk import screen | `modules/member-imports/**` | Cenários 22, 23 | 21 |
| 25 | #138 | Build the classes list and detail | `modules/classes/**` | Cenário 25 | 18 |
| 26 | #139 | Build enrollment management | `modules/classes/components/enrollments-*` | Cenário 24 | 25 |
| 27 | #140 | Build the devices screen with one-time key display | `modules/devices/**` | Cenário 26 | 18 |

### Epic F4 — Biometria e chamada

| # | Issue | Título | Escopo | Critério de aceite | Depende de |
| --- | --- | --- | --- | --- | --- |
| 28 | #141 | Build biometric enrollment from the webcam | `modules/biometrics/components/camera-capture` | Cenários 27, 31 | 21 |
| 29 | #142 | Build biometric enrollment from a file | `modules/biometrics/components/file-capture` | Cenários 28, 29 | 28 |
| 30 | #143 | Handle frame rejection on enrollment | `modules/biometrics/**` | Cenário 30 | 28 |
| 31 | #144 | Build the biometric profiles list and revocation | `modules/biometrics/**` | Cenários 32, 33 | 21 |
| 32 | #145 | Build session opening and recovery | `modules/attendance/**` | Cenários 34, 35 | 25, 27 |
| 33 | #146 | Build the live panel with conditional polling | `modules/attendance/components/live-panel` | Cenários 36, 37, 38, 47 | 32 |
| 34 | #147 | Build manual correction | `modules/attendance/components/manual-*` | Cenário 39 | 33 |
| 35 | #148 | Build the offline queue for manual correction | `modules/attendance/offline-queue/**` | Cenários 40, 41, 42, 43, 44 | 34, 14 |
| 36 | #149 | Build session closing with If-Match | `modules/attendance/components/close-session` | Cenários 45, 46 | 33 |

### Epic F5 — Relatórios e governança

| # | Issue | Título | Escopo | Critério de aceite | Depende de |
| --- | --- | --- | --- | --- | --- |
| 37 | #150 | Build the attendance report | `modules/reports/attendance/**` | Cenários 48, 49 | 25 |
| 38 | #151 | Build CSV export in the browser | `modules/reports/export/**` | Cenário 50 | 37 |
| 39 | #152 | Build the wellbeing report with suppression | `modules/reports/wellbeing/**` | Cenário 51 | 18 |
| 40 | #153 | Build the read-only audit trail | `modules/audit-logs/**` | Cenário 52 | 18 |
| 41 | #154 | Build the retention screen | `modules/retention/**` | Cenário 53 | 18 |
