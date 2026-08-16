# SPEC-002 — API do Vultra: contrato final e estrutura modular

> **Status:** publicada
> **Perfil:** API
> **Módulo:** `apps/api-core`
> **Epics:** #74 (E1) · #75 (E2) · #76 (E3) · #77 (E4) · #78 (E5)
> **Requisitos cobertos:** RF-01 a RF-14, RF-20, RF-21, RNF-01, RNF-03, RNF-04, RNF-06 a RNF-15
> **Decisão relacionada:** `docs/decisions/0003-contrato-e-estrutura-da-api.md`
> **Fecha:** Q-06 (turma), Q-04 parcialmente (cadastro manual e importação; integração segue aberta)

Esta spec descreve a API do Vultra na sua **versão final** — o contrato inteiro, incluindo recursos que
não existem hoje. Ela é dividida em cinco epics ao final do documento.

Duas coisas justificam refazer `/v1` em vez de estendê-lo. Primeira: não existe consumidor em produção —
`firmware/esp32-cam/` contém apenas um `.gitkeep`, nenhum piloto rodou e RNF-22 proíbe dado real antes de
Q-01 fechar. Segunda: o contrato atual **já está quebrado** — `frontend-professores` chama
`/v1/attendance/records` e `/v1/biometric/`, e nenhuma das duas existe. Consertar o contrato custa editar
código nosso hoje; depois custa reflashar hardware instalado em sala.

---

## Acceptance Criteria

### 1. Convenções transversais

Valem para toda rota sob `/v1`, sem exceção. Uma rota que não as siga é defeito, não variação.

| Assunto | Decisão |
| --- | --- |
| Versionamento | Prefixo de caminho `/v1`. Mudança quebrante exige `/v2`; dentro de `/v1` só entra campo opcional, rota nova ou valor novo de enum |
| Autenticação de usuário | Better Auth em `/api/auth/*`, fora de `/v1` por ser handler próprio da biblioteca |
| Caminho | `kebab-case`, coleção sempre no plural, aninhamento de no máximo dois níveis |
| Campo | `camelCase` em requisição e resposta |
| Identificador | UUID v7, opaco. Nenhum cliente deriva significado dele |
| Tempo | ISO 8601 em UTC com sufixo `Z`. Campo de instante termina em `At`, campo de data em `On` |
| Ausência | Campo opcional presente e `null` quando o recurso o possui vazio; ausente quando o papel do chamador não o alcança |
| Corpo e query | Validados contra schema com `additionalProperties: false`. Campo desconhecido responde `422`, nunca é ignorado |
| Campo de servidor | `id`, `organizationId`, `createdAt`, `updatedAt`, `role` em recurso próprio e qualquer contador são de escrita exclusiva do servidor. Enviá-los responde `422` |

### 2. Envelope de coleção

Uma forma única para toda coleção. Nenhuma rota devolve array nu.

```json
{
  "items": [],
  "page": { "nextCursor": "eyJ2IjoiMjAyNi0wOC0xNlQxMjowMDowMFoiLCJpIjoiMDE5..." , "limit": 50 }
}
```

- `limit`: inteiro, `1` a `100`, padrão `50`. Fora da faixa responde `422`.
- `cursor`: string opaca base64url. Cursor inválido ou expirado responde `400 INVALID_CURSOR`.
- `nextCursor` é `null` na última página.
- **Não existe `total`.** Contar exige varrer a coleção inteira e nenhum consumidor precisa do número.
- Ordenação e filtro são conjunto fechado por rota, declarado na seção do módulo. Campo fora da lista
  responde `422`.

### 3. Forma de erro

Uma forma única em toda a API, incluindo `/api/auth/*` por reescrita no handler global.

```json
{
  "error": {
    "code": "INSUFFICIENT_PERMISSIONS",
    "message": "Insufficient permissions",
    "correlationId": "0198c4a1-6f3e-7c21-9a44-1b2c3d4e5f60",
    "details": [{ "field": "limit", "rule": "maximum", "message": "limit must be at most 100" }]
  }
}
```

- `code` é estável e o cliente ramifica por ele. `message` é prosa em inglês, nunca ramificável.
- `details` existe apenas em falha de validação, com **todas** as violações de uma vez.
- `message` e `details` nunca contêm corpo da requisição, SQL, caminho de arquivo, nome de host, nome de
  biblioteca nem `frameBase64` (RNF-11, RNF-01).
- Falha de negócio nunca é `5xx`. `5xx` é reservado a falha real do servidor.

### 4. Correlation ID

- O servidor aceita `X-Correlation-Id` do cliente quando for UUID v4 ou v7; caso contrário gera um.
- Ecoado em `X-Correlation-Id` em **toda** resposta, inclusive erro, e presente em toda linha de log e no
  corpo do erro. Fecha RNF-15.
- O log registra rota, método, status, latência, identidade do chamador e correlation id. Nunca corpo,
  credencial, embedding nem rótulo afetivo.

### 5. Papéis e autorização

Três papéis. O aluno não autentica: o Vultra é ferramenta de gestão interna e não tem interface de aluno.

| Permissão | `gestor` | `professor` | `rh` |
| --- | :---: | :---: | :---: |
| `members:read` | sim | sim | não |
| `members:manage` | sim | não | não |
| `classes:read` | sim | só as próprias | não |
| `classes:manage` | sim | não | não |
| `devices:manage` | sim | não | não |
| `biometrics:enroll` | sim | não | não |
| `biometrics:verify` | sim | não | não |
| `biometrics:read` | sim | não | não |
| `biometrics:revoke` | sim | não | não |
| `attendance:read` | sim | só as próprias | não |
| `attendance:write` | sim | só as próprias | não |
| `reports:read` | sim | só as próprias | sim |
| `audit:read` | sim | não | não |
| `retention:execute` | sim | não | não |

Regras que a matriz não expressa:

- **Default-DENY.** Uma rota sem declaração explícita de permissão não é servida. O guard é único, vive na
  fronteira HTTP e nenhuma rota implementa checagem própria (ADR-0001 §1).
- **"Só as próprias"** significa turmas em que o membro correspondente ao usuário é o professor
  responsável, e as sessões dessas turmas. É decidido no servidor a cada requisição, nunca por filtro
  enviado pelo cliente.
- O papel `rh` existe porque o dado agregado não pode ser público. Ele alcança **apenas**
  `GET /v1/reports/wellbeing`. Nenhum acesso a biometria, membro, turma ou registro individual.
- O papel `student` do código atual é removido: não há interface de aluno nesta entrega, e papel
  autenticado sem cliente é superfície sem consumidor.
- Negação por papel e negação por tenant respondem igual: `403 INSUFFICIENT_PERMISSIONS` para operação
  não permitida, `404` para recurso de outro tenant. Nenhuma das duas revela existência.

### 6. Limites, cotas e prazos

| Limite | Valor | Onde |
| --- | --- | --- |
| Corpo máximo, rota comum | `65536` bytes | Toda rota sob `/v1` |
| Corpo máximo, rota com quadro facial | `1048576` bytes de `frameBase64` | Rotas biométricas e `POST` de registro |
| Cota por usuário, rota biométrica | `10` requisições por segundo | `/v1/biometric-profiles`, `/v1/biometric-verifications` |
| Cota por organização, rota biométrica | `20` requisições por segundo | idem |
| Cota por dispositivo | `5` requisições por segundo | `POST /v1/attendance/sessions/{sessionId}/records` |
| Cota por organização, rota de dispositivo | `30` requisições por segundo | idem |
| Cota por usuário, demais rotas | `120` requisições por minuto | Todo o resto de `/v1` |
| Bloqueio após estouro | `60` segundos | Todas as cotas |
| Orçamento de reconhecimento | `3000` ms ponta a ponta | Fixado pela SPEC-001 |
| Timeout de operação de banco | `5000` ms | Toda query (RNF-14) |

O estado de cota vive em Redis. **Redis indisponível nega com `503`** nas rotas biométricas e nas de
dispositivo, nunca libera (ADR-0001 §3). Nas demais rotas, Redis indisponível também nega — uma exceção
por rota seria a mesma decisão caso a caso que produziu o estado atual.

Toda resposta de rota com cota carrega `RateLimit-Limit`, `RateLimit-Remaining` e `RateLimit-Reset`. O
`429` carrega adicionalmente `Retry-After` em segundos.

### 7. Concorrência e cache

- **Sessão de chamada** é o único recurso com concorrência otimista: `GET` devolve `ETag`, `PATCH` exige
  `If-Match`, valor obsoleto responde `412 PRECONDITION_FAILED`. É onde a colisão é real — professor no
  celular e gestor no desktop na mesma aula.
- **Registros de uma sessão** devolvem `ETag` derivado do último registro. O portal repete o `GET` com
  `If-None-Match`; sem novidade a resposta é `304` sem corpo. É o mecanismo de RF-11.
- Nenhuma outra rota é cacheável. Toda resposta autenticada carrega `Cache-Control: private, no-store`.

### 8. Estrutura modular

`src/` passa a ser fatiado por módulo de negócio, com o hexágono dentro de cada módulo. Isto **emenda o
ADR-004**, que decidiu camada técnica de primeiro nível.

```
src/
├── main.ts                         monta e escuta, nada mais
├── modules/
│   ├── identity/
│   │   ├── domain/
│   │   ├── application/
│   │   │   ├── ports/
│   │   │   └── <verbo>-<nome>.use-case.ts
│   │   ├── infrastructure/
│   │   │   ├── inbound/
│   │   │   └── outbound/
│   │   └── identity.wiring.ts
│   ├── classes/
│   ├── devices/
│   ├── biometrics/
│   ├── attendance/
│   └── reports/
└── shared/
    ├── kernel/                     erro de domínio, tipos de tenant, envelope de página
    └── infra/                      env, database, redis, http (erro, correlation, cota, auth)
```

Regras de fronteira:

- A seta é `infrastructure → application → domain`, nunca ao contrário. `domain` não importa nada externo.
- Porta vive em `application/ports/`, nomeada pela capacidade, **sem prefixo `I`**. Adaptador carrega a
  tecnologia no nome: `<capacidade>.<tecnologia>.adapter.ts`.
- Um módulo alcança outro **apenas** por `<módulo>.wiring.ts`. Nunca pelo `domain/` nem pelo
  `infrastructure/` alheio. Entre agregados de módulos diferentes a referência é por identificador.
- Validação de fronteira vive no adaptador de entrada. Nenhum tipo de Elysia, TypeBox, Drizzle ou ioredis
  aparece em assinatura de use-case.
- Todo adaptador de entrada passa por um use-case. Nenhum alcança `domain/` direto.
- Teste fica ao lado do arquivo que testa. `src/__tests__/` deixa de existir.

Fiação: cada `<módulo>.wiring.ts` é a raiz de composição do módulo e sua única superfície pública.
`main.ts` registra os módulos e escuta. **O padrão `init<X>Routes()` com `let _useCase: T | null = null`
no topo do módulo é eliminado** — junto com os 26 `if (!_x) throw new Error("...not initialized")` que
ele obriga a escrever.

### 9. Configuração

Um módulo único em `shared/infra/env`. Nenhum outro arquivo lê o ambiente. Toda variável é obrigatória,
validada no boot, e o processo não sobe com configuração incompleta — o erro nomeia a variável ausente e o
formato esperado. **Nenhum valor padrão no ponto de leitura**, em nenhum ambiente (ADR-0001 §6). Os cinco
fallbacks atuais (`PORT`, `AI_QUEUE_NAME`, `AI_RESULT_PREFIX`, `BETTER_AUTH_URL`,
`BETTER_AUTH_TRUSTED_ORIGINS`) desaparecem.

---

## Superfície por módulo

Status em cada operação: **existe** (permanece com ajuste de contrato), **renomeia** (mesma capacidade,
caminho novo), **nova** (não existe hoje).

**Origem dos campos.** Para recurso marcado **existe** ou **renomeia**, o conjunto de campos é o que já
está declarado no schema TypeBox da rota atual e na tabela correspondente; esta spec declara apenas os
campos que **mudam**, e qualquer campo não citado aqui permanece com tipo, obrigatoriedade e origem
inalterados. Para recurso marcado **nova**, todos os campos estão declarados abaixo, com tipo,
obrigatoriedade e de onde vem o valor.

### `identity` — membros da instituição

| Operação | Permissão | Status |
| --- | --- | --- |
| `GET /v1/members` | `members:read` | existe |
| `POST /v1/members` | `members:manage` | existe |
| `GET /v1/members/{memberId}` | `members:read` | existe |
| `PATCH /v1/members/{memberId}` | `members:manage` | existe |
| `DELETE /v1/members/{memberId}` | `members:manage` | existe |
| `POST /v1/member-imports` | `members:manage` | nova |
| `GET /v1/member-imports/{importId}` | `members:manage` | nova |

`GET /v1/members` — filtros `role`, `isActive`, `search`; ordenação `fullName` ou `createdAt`, padrão
`fullName` ascendente. `limit` e `offset` deixam de ser `string` convertida por `Number()`: passam a
`limit` inteiro e `cursor` opaco.

`DELETE` é desativação lógica e revoga o perfil biométrico do membro na mesma transação (RF-07).

`POST /v1/member-imports` — corpo `{ "members": [...] }`, no máximo `500` entradas, cada uma com os mesmos
campos de `POST /v1/members`. Responde `202` com o recurso de importação. A importação é **parcial por
linha**: uma entrada inválida não impede as demais.

`GET /v1/member-imports/{importId}` — devolve `status` em `pending`, `running`, `completed` ou `failed`, e
`results` com `{ line, status, memberId, errorCode }` por entrada. Retido por `7` dias.

### `classes` — turma, matrícula e professor responsável

Módulo inteiramente novo. Fecha Q-06.

| Operação | Permissão | Status |
| --- | --- | --- |
| `GET /v1/classes` | `classes:read` | nova |
| `POST /v1/classes` | `classes:manage` | nova |
| `GET /v1/classes/{classId}` | `classes:read` | nova |
| `PATCH /v1/classes/{classId}` | `classes:manage` | nova |
| `DELETE /v1/classes/{classId}` | `classes:manage` | nova |
| `GET /v1/classes/{classId}/enrollments` | `classes:read` | nova |
| `PUT /v1/classes/{classId}/enrollments/{memberId}` | `classes:manage` | nova |
| `DELETE /v1/classes/{classId}/enrollments/{memberId}` | `classes:manage` | nova |

Campos de turma: `name` (`string`, `2` a `120`), `code` (`string`, `1` a `32`, único no tenant),
`professorId` (UUID de membro com papel `professor`, obrigatório), `isActive` (`boolean`, servidor).

Matrícula é `PUT` idempotente: matricular duas vezes o mesmo membro é `200`, não `409`. Um membro só é
matriculável se for do mesmo tenant e tiver papel `student` no cadastro — o papel de cadastro do aluno
permanece, o que morre é o **login** de aluno.

Para o papel `professor`, `GET /v1/classes` devolve apenas as turmas em que ele é o responsável, e qualquer
operação sobre turma alheia responde `404`.

### `devices` — câmeras ESP32-CAM

| Operação | Permissão | Status |
| --- | --- | --- |
| `GET /v1/devices` | `devices:manage` | existe |
| `POST /v1/devices` | `devices:manage` | existe |
| `GET /v1/devices/{deviceId}` | `devices:manage` | nova |
| `PATCH /v1/devices/{deviceId}` | `devices:manage` | existe |
| `DELETE /v1/devices/{deviceId}` | `devices:manage` | existe |
| `POST /v1/devices/{deviceId}/keys` | `devices:manage` | renomeia (`/rotate-key`) |

`POST /v1/devices` e `POST /v1/devices/{deviceId}/keys` respondem `201` com a chave em claro **uma única
vez**, no corpo. A chave nunca reaparece em nenhuma leitura, log ou erro. Rotacionar invalida a anterior
imediatamente (RF-04, ADR-0001 §5).

`GET /v1/devices` — filtro `isActive`; ordenação `name`, padrão ascendente.

### `biometrics` — perfil biométrico e verificação

O caminho `/v1/face/*` é substituído. O recurso canônico do ADR-006 é `biometric_profiles`, e
`face/enroll` e `face/verify` são verbos no caminho — a própria rota `DELETE /v1/face/{profileId}` já
denuncia que o recurso é um perfil, não uma "face".

| Operação | Permissão | Status |
| --- | --- | --- |
| `GET /v1/biometric-profiles` | `biometrics:read` | renomeia (`/v1/face/list`) |
| `POST /v1/biometric-profiles` | `biometrics:enroll` | renomeia (`/v1/face/enroll`) |
| `DELETE /v1/biometric-profiles/{profileId}` | `biometrics:revoke` | renomeia (`/v1/face/{profileId}`) |
| `POST /v1/biometric-verifications` | `biometrics:verify` | renomeia (`/v1/face/verify`) |

`POST /v1/biometric-profiles` — corpo `{ memberId, frameBase64 }`. Responde `201` com
`Location: /v1/biometric-profiles/{profileId}` e corpo `{ profileId, memberId, qualityScore, modelVersion,
enrolledAt }`. Nunca devolve o embedding.

`POST /v1/biometric-verifications` — corpo `{ frameBase64, memberId? }`, onde `memberId` é filtro 1:N
opcional, nunca identidade canônica. Responde `200` (ADR-006 §2) com:

```json
{ "result": "MATCH", "memberId": "0198...", "confidence": 0.91, "processingMs": 812 }
```

`result` é `MATCH`, `POSSIBLE` ou `NO_MATCH`. **O literal acentuado `POSSÍVEL` deixa de existir** —
`CLAUDE.md` já o classifica como dívida, e valor de enum em contrato público é código, logo inglês.
`memberId` é omitido quando `result` é `NO_MATCH`.

`GET /v1/biometric-profiles` — filtro `memberId`, `isActive`; ordenação `enrolledAt`, padrão descendente.
O campo `faceEmbedding` **nunca** aparece em nenhuma resposta.

`DELETE` inutiliza o vetor, não apenas marca deleção (ADR-0001 §7, RF-07).

O legado `/v1/face/*` e `/v1/biometric/*` respondem `404`, sem alias temporário — mesma política de cutover
do ADR-006.

### `attendance` — sessão de chamada e registro de presença

| Operação | Autenticação | Permissão | Status |
| --- | --- | --- | --- |
| `POST /v1/attendance/sessions` | usuário | `attendance:write` | existe |
| `GET /v1/attendance/sessions` | usuário | `attendance:read` | nova |
| `GET /v1/attendance/sessions/{sessionId}` | usuário | `attendance:read` | nova |
| `PATCH /v1/attendance/sessions/{sessionId}` | usuário | `attendance:write` | renomeia (`/close`) |
| `GET /v1/attendance/sessions/{sessionId}/records` | usuário | `attendance:read` | existe |
| `POST /v1/attendance/sessions/{sessionId}/records` | dispositivo | — | renomeia (`/attendance/record`) |
| `PUT /v1/attendance/sessions/{sessionId}/records/{memberId}` | usuário | `attendance:write` | renomeia (`/records/manual`) |
| `DELETE /v1/attendance/sessions/{sessionId}/records/{memberId}` | usuário | `attendance:write` | nova |

`POST /v1/attendance/sessions` — corpo `{ classId, deviceId }`. `professorId` **deixa de ser aceito do
cliente**: é derivado do responsável pela turma. Isso remove a escalada por falsa atribuição na origem, em
vez de guardá-la com uma checagem de papel. Responde `201` com `Location`.

`GET /v1/attendance/sessions` — filtros `status` (`open` ou `closed`), `classId`, `from`, `to`; ordenação
`startedAt`, padrão descendente. É o mecanismo de RF-13: o professor recarrega a página, pede
`?status=open` e reencontra a sessão.

`PATCH /v1/attendance/sessions/{sessionId}` — corpo `{ "status": "closed" }`, exige `If-Match`. Único campo
aceito. Fechar sessão já fechada responde `409 SESSION_ALREADY_CLOSED`.

`GET /v1/attendance/sessions/{sessionId}/records` — devolve `ETag`. Com `If-None-Match` e nenhum registro
novo, responde `304` sem corpo. Ordenação `recordedAt` ascendente, fixa.

`POST /v1/attendance/sessions/{sessionId}/records` — autenticação de dispositivo por `X-API-Key`, corpo
`{ frameBase64 }`. O `sessionId` sai do corpo e vai para o caminho; `organizationId` e `deviceId` vêm do
token, nunca do cliente. **Ganha cota e teto de payload**, que hoje não tem nenhum dos dois. Responde `201`
no registro criado, `200` com o registro existente quando o membro já está presente (RF-10), e `422` quando
o quadro é recusado por qualidade, frontalidade ou vivacidade.

`PUT /v1/attendance/sessions/{sessionId}/records/{memberId}` — corpo `{ notes? }`, no máximo `500`
caracteres. Idempotente: cria com `201` ou atualiza com `200`. `recognitionMethod` é `manual`, distinguível
do automático em todo relatório e auditoria (RF-12).

`DELETE .../records/{memberId}` — remove presença registrada por engano. Fecha a metade "corrige" de RF-12,
que hoje não tem caminho nenhum. Gera auditoria com o registro removido.

### `reports` — frequência e agregação afetiva

| Operação | Permissão | Status |
| --- | --- | --- |
| `GET /v1/reports/attendance` | `reports:read` | existe |
| `GET /v1/reports/wellbeing` | `reports:read` | existe |

`GET /v1/reports/attendance` — parâmetros `classId`, `from`, `to` obrigatórios, janela máxima de `366`
dias. `from` posterior a `to` responde `400 INVALID_REPORT_RANGE`. Devolve por membro matriculado:
presenças, faltas e percentual. Falta é computável porque a matrícula existe (`classes`).

`GET /v1/reports/wellbeing` — parâmetros `classId?`, `professorId?`, `from`, `to`. Devolve distribuição dos
sete rótulos afetivos fixados pela SPEC-001, agregada por recorte.

**Tamanho mínimo de grupo (RF-18): `5`.** Qualquer recorte que resolva para menos de `5` registros
distintos de membro responde com o recorte presente e os valores `null`, mais
`suppressed: true`. Nunca com valor parcial e nunca com `404` — ausência seletiva permitiria inferir o
tamanho do grupo por diferença. O papel `rh` alcança **apenas** esta rota.

### `audit` — trilha de auditoria

| Operação | Permissão | Status |
| --- | --- | --- |
| `GET /v1/audit-logs` | `audit:read` | nova |

Filtros `action`, `resourceType`, `resourceId`, `actorId`, `from`, `to`; ordenação `createdAt`, padrão
descendente. Devolve `{ id, action, resourceType, resourceId, actorId, actorType, ipAddress, createdAt,
payload }`.

`payload` **nunca** contém `frameBase64`, embedding nem rótulo afetivo (ADR-0001 §7). A trilha só é
legível; não existe rota de escrita nem de deleção — é a garantia de imutabilidade de RNF-04.

### `retention` — execução do prazo de descarte

| Operação | Permissão | Status |
| --- | --- | --- |
| `POST /v1/retention-runs` | `retention:execute` | nova |

Dá a RNF-03 o executor que ele exige e não tem. Não há agendador dentro do `api-core`: a instância chama a
rota. Prazos declarados:

| Dado | Prazo | Ação ao vencer |
| --- | --- | --- |
| Perfil biométrico revogado | `30` dias após a revogação | Linha apagada; a auditoria da revogação permanece |
| Registro de importação de membros | `7` dias após a conclusão | Linha apagada |
| Registro de presença | `1825` dias (5 anos) após `recordedAt` | Linha apagada |
| Registro de auditoria | `1825` dias após `createdAt` | Linha apagada |

Responde `200` com a contagem apagada por tipo. Teto de `10000` linhas por execução e por tipo; chamar de
novo continua de onde parou. A execução é auditada.

### `health`

| Operação | Autenticação | Status |
| --- | --- | --- |
| `GET /v1/health` | pública | renomeia |
| `GET /v1/health/dependencies` | `gestor` | renomeia (`/health/ai-service`) |

`GET /v1/health` responde `{ "status": "ok" }` — nada além disso. `GET /v1/health/dependencies` devolve o
estado do circuit breaker e do Redis, e passa a exigir autenticação: contagem de falha e horário da última
falha são informação operacional, e hoje qualquer um na rede as lê.

---

## Campos dos recursos novos

Obrigatoriedade refere-se à requisição de criação. Campo de origem `servidor` responde `422` se enviado.

### `class`

| Campo | Tipo | Obrigatório | Origem e validação |
| --- | --- | --- | --- |
| `id` | `string` | — | Servidor. UUID v7 |
| `organizationId` | `string` | — | Servidor. Sessão do chamador |
| `name` | `string` | sim | Cliente. `2` a `120` caracteres |
| `code` | `string` | sim | Cliente. `1` a `32` caracteres, único no tenant |
| `professorId` | `string` | sim | Cliente. UUID de membro do tenant com papel `professor` |
| `isActive` | `boolean` | — | Servidor. `true` na criação; `false` após `DELETE` |
| `enrollmentCount` | `number` | — | Servidor. Inteiro, contagem de matrículas ativas |
| `createdAt` / `updatedAt` | `string` | — | Servidor. ISO 8601 UTC |

### `enrollment`

| Campo | Tipo | Obrigatório | Origem e validação |
| --- | --- | --- | --- |
| `classId` | `string` | sim | Caminho. UUID de turma do tenant |
| `memberId` | `string` | sim | Caminho. UUID de membro do tenant com papel `student` |
| `enrolledAt` | `string` | — | Servidor. ISO 8601 UTC |

### `memberImport`

| Campo | Tipo | Obrigatório | Origem e validação |
| --- | --- | --- | --- |
| `id` | `string` | — | Servidor. UUID v7 |
| `members` | `array` | sim | Cliente. `1` a `500` entradas, cada uma com os campos de `POST /v1/members` |
| `status` | `string` | — | Servidor. `pending`, `running`, `completed` ou `failed` |
| `results` | `array` | — | Servidor. Uma entrada por linha enviada |
| `results[].line` | `number` | — | Servidor. Índice na requisição, base `0` |
| `results[].status` | `string` | — | Servidor. `created` ou `rejected` |
| `results[].memberId` | `string \| null` | — | Servidor. UUID quando `created`, `null` quando `rejected` |
| `results[].errorCode` | `string \| null` | — | Servidor. Código da tabela de erros quando `rejected` |
| `createdAt` / `completedAt` | `string \| null` | — | Servidor. ISO 8601 UTC; `completedAt` é `null` até terminar |

### `auditLog`

| Campo | Tipo | Origem |
| --- | --- | --- |
| `id` | `string` | Servidor. UUID v7 |
| `action` | `string` | Servidor. Conjunto fechado de ações auditadas |
| `resourceType` | `string` | Servidor. Nome da tabela afetada |
| `resourceId` | `string \| null` | Servidor. `null` quando a operação não criou recurso |
| `actorId` | `string` | Servidor. Usuário ou dispositivo que agiu |
| `actorType` | `string` | Servidor. `user` ou `device` |
| `ipAddress` | `string \| null` | Servidor. Primeiro endereço de `X-Forwarded-For`, ou `X-Real-Ip` |
| `payload` | `object` | Servidor. Metadado da operação. Nunca quadro, embedding ou rótulo afetivo |
| `createdAt` | `string` | Servidor. ISO 8601 UTC |

### `retentionRun`

| Campo | Tipo | Origem |
| --- | --- | --- |
| `executedAt` | `string` | Servidor. ISO 8601 UTC |
| `deleted` | `object` | Servidor. Contagem inteira por tipo |
| `deleted.biometricProfiles` | `number` | Servidor |
| `deleted.memberImports` | `number` | Servidor |
| `deleted.attendanceRecords` | `number` | Servidor |
| `deleted.auditLogs` | `number` | Servidor |
| `capped` | `boolean` | Servidor. `true` quando algum tipo atingiu o teto de `10000` e resta trabalho |

---

## Regras de Negócio

**R1 — Toda rota declara sua permissão.** Uma rota registrada sem declaração explícita não é servida: o
processo falha no boot nomeando o caminho. Não existe rota "esquecida" que fique aberta.

**R2 — Nenhum acesso a dado de tenant acontece fora de `withTenantContext()`.** Vale para rota, script,
seed e job. Toda tabela com `organization_id` tem `ENABLE` e `FORCE ROW LEVEL SECURITY`, com predicado
`NULLIF(current_setting('app.current_org_id', TRUE), '')::UUID`. As tabelas `audit_logs` e `organizations`,
hoje sem policy, passam a tê-la.

**R3 — O tenant nunca vem do cliente.** `organizationId` sai da sessão do usuário ou do token do
dispositivo. Nenhuma rota o aceita em corpo, query ou caminho.

**R4 — Recurso de outro tenant responde `404`.** Idêntico a recurso inexistente, no corpo, no código e sem
diferença observável de tempo de resposta.

**R5 — A cota é avaliada depois de autenticação e autorização**, por usuário e por organização nas rotas de
usuário, e por dispositivo e organização nas de dispositivo. Vence o primeiro limite excedido. Redis
indisponível responde `503 RATE_LIMITER_UNAVAILABLE`.

**R6 — Um quadro facial nunca é persistido.** Não entra em banco, disco, log, `audit_logs`, mensagem de
erro nem resposta. Existe apenas em memória durante o processamento.

**R7 — Toda operação sobre dado biométrico gera auditoria**, inclusive as que falham e as automáticas, com
quem, quando e sobre qual recurso — nunca com o conteúdo.

**R8 — Presença é única por membro e sessão.** Uma segunda captura do mesmo membro na mesma sessão devolve
`200` com o registro existente, sem criar duplicata e sem erro.

**R9 — Quadro com mais de um rosto não registra presença.** A câmera fica na porta e os alunos passam um
por vez; mais de um rosto é ambíguo quanto a quem está presente (RF-10).

**R10 — A sessão pertence à turma, e o professor à turma.** `professorId` nunca vem do cliente: é derivado
do responsável pela turma no momento da abertura.

**R11 — O professor alcança apenas as próprias turmas e sessões.** Decidido no servidor a cada requisição.
Um identificador correto de turma alheia responde `404`.

**R12 — Nenhum recorte afetivo com menos de `5` membros distintos é exposto.** O recorte aparece com
valores `null` e `suppressed: true`, nunca é omitido.

**R13 — Toda coleção é limitada.** Não existe rota que devolva o cadastro inteiro de um tenant. `limit`
máximo `100`, padrão `50`.

**R14 — Configuração incompleta impede o boot.** Nenhum valor padrão no ponto de leitura, em nenhum
ambiente.

**R15 — Todo erro carrega o correlation id**, e o correlation id aparece em toda linha de log da mesma
requisição.

**R16 — Fechar sessão exige `If-Match`.** Sem o header responde `428 PRECONDITION_REQUIRED`; com valor
obsoleto responde `412 PRECONDITION_FAILED`.

**R17 — Um perfil biométrico revogado deixa de ser reconhecido a partir da próxima captura**, e o vetor é
inutilizado, não apenas marcado.

**R18 — Cada regra acima só é considerada atendida quando existe um teste que falha se o guard for
removido** (ADR-0001 §8). Onde o guard é policy de banco, o teste conecta a um Postgres real.

---

## Erros

| Código | HTTP | Mensagem literal | Quando |
| --- | --- | --- | --- |
| `UNAUTHORIZED` | 401 | `Authentication required` | Sessão ausente ou inválida |
| `INVALID_DEVICE_TOKEN` | 401 | `Invalid or missing device token` | `X-API-Key` ausente, inválida ou de dispositivo inativo |
| `INSUFFICIENT_PERMISSIONS` | 403 | `Insufficient permissions` | Papel não tem a permissão da rota |
| `NOT_FOUND` | 404 | `Resource not found` | Recurso inexistente **ou** de outro tenant |
| `VALIDATION_ERROR` | 422 | `Request validation failed` | Schema violado, campo desconhecido, campo de servidor enviado |
| `INVALID_CURSOR` | 400 | `Pagination cursor is invalid or expired` | Cursor não decodificável |
| `INVALID_REPORT_RANGE` | 400 | `Report range is invalid` | `from` posterior a `to`, ou janela acima de 366 dias |
| `ATTENDANCE_CONFLICT` | 409 | `Presence already recorded for this member in this session` | Registro manual de membro já presente |
| `SESSION_ALREADY_CLOSED` | 409 | `Attendance session is already closed` | Escrita em sessão fechada |
| `CLASS_CODE_TAKEN` | 409 | `Class code already exists in this organization` | `code` duplicado no tenant |
| `PRECONDITION_REQUIRED` | 428 | `If-Match header is required` | `PATCH` de sessão sem `If-Match` |
| `PRECONDITION_FAILED` | 412 | `Resource was modified by another request` | `If-Match` obsoleto |
| `PAYLOAD_TOO_LARGE` | 413 | `Payload exceeds the maximum allowed size` | Corpo acima do teto da rota |
| `RATE_LIMIT_EXCEEDED` | 429 | `Too many requests` | Cota estourada. Carrega `Retry-After` |
| `RATE_LIMITER_UNAVAILABLE` | 503 | `Rate limiter is unavailable` | Redis inalcançável. Nega, nunca libera |
| `LOW_QUALITY_FRAME` | 422 | `Frame quality is below the accepted threshold` | Quadro recusado por qualidade |
| `NO_FRONTAL_FACE` | 422 | `Face is not frontal enough to be processed` | Gate de frontalidade da SPEC-001 |
| `LIVENESS_CHECK_FAILED` | 422 | `Capture did not pass the liveness check` | Foto ou tela (RF-22) |
| `MULTIPLE_FACES` | 422 | `More than one face detected in the frame` | R9 |
| `NO_FACE_DETECTED` | 422 | `No face detected in the frame` | Nenhum rosto |
| `MEMBER_NOT_FOUND` | 404 | `Resource not found` | Membro inexistente ou de outro tenant |
| `BIOMETRIC_PROFILE_NOT_FOUND` | 404 | `Resource not found` | Perfil inexistente, revogado ou de outro tenant |
| `MEMBER_NOT_ENROLLED_IN_CLASS` | 409 | `Member is not enrolled in this class` | Registro manual de não matriculado |
| `AI_SERVICE_UNAVAILABLE` | 503 | `AI service is currently unavailable` | Circuito aberto ou orçamento estourado. Carrega `Retry-After` |
| `INTERNAL_SERVER_ERROR` | 500 | `Internal server error` | Falha real do servidor. Nunca falha de negócio |

`MEMBER_NOT_FOUND` e `BIOMETRIC_PROFILE_NOT_FOUND` carregam a mensagem genérica de `NOT_FOUND` para não
revelar existência; o código distinto serve ao log e à métrica, não ao cliente.

---

## Efeitos Colaterais

| Ação | Efeito |
| --- | --- |
| Cadastro biométrico | Linha em `biometric_profiles`; perfil ativo anterior do mesmo membro e modelo é desativado na mesma transação; auditoria `BIOMETRIC_PROFILE_ENROLLED` |
| Verificação biométrica | Nenhuma escrita de perfil; `lastMatchedAt` atualizado em `MATCH`; auditoria `BIOMETRIC_PROFILE_VERIFIED` com o desfecho e sem o quadro |
| Revogação biométrica | `is_active = FALSE`, `face_embedding = NULL`, colunas de deleção preenchidas; auditoria `BIOMETRIC_PROFILE_REVOKED` |
| Desativação de membro | Membro desativado e perfil biométrico revogado na mesma transação; duas auditorias |
| Abertura de sessão | Linha em `attendance_sessions` com `status = open`; auditoria |
| Registro automático | Linha em `attendance_records` com `recognitionMethod = automatic`; `ETag` da coleção muda; auditoria |
| Registro manual | Linha com `recognitionMethod = manual` e `actorId` do professor; `ETag` muda; auditoria |
| Remoção de registro | Linha apagada; `ETag` muda; auditoria `ATTENDANCE_RECORD_DELETED` com o membro e o motivo |
| Rotação de chave de dispositivo | Chave anterior invalidada imediatamente; nova chave em claro apenas na resposta; auditoria sem a chave |
| Importação de membros | Linha em `member_imports` mais uma linha em `members` por entrada válida; auditoria por membro criado |
| Execução de retenção | Linhas apagadas conforme os prazos; auditoria com as contagens |
| Qualquer requisição | Linha de log com rota, método, status, latência, identidade e correlation id — nunca com corpo |

---

## Cenários de Aceite (Gherkin)

**Cenário 1 — Rota sem permissão declarada não sobe**
```gherkin
Dado um módulo que registra uma rota sem declarar permissão
Quando o processo é iniciado
Então o boot falha nomeando o método e o caminho da rota
E nenhuma porta é aberta
```

**Cenário 2 — Papel sem a permissão é negado**
```gherkin
Dado um usuário autenticado com papel professor
Quando ele requisita POST /v1/biometric-profiles
Então a resposta é 403 com código INSUFFICIENT_PERMISSIONS
E nenhum perfil é criado
```

**Cenário 3 — Recurso de outro tenant é indistinguível de inexistente**
```gherkin
Dado um gestor autenticado da organização A
E um membro que pertence à organização B
Quando ele requisita GET /v1/members/{memberId} com o identificador correto
Então a resposta é 404 com código NOT_FOUND
E a resposta é idêntica à de um identificador que não existe em organização nenhuma
```

**Cenário 4 — Contexto de tenant ausente não devolve linha nenhuma**
```gherkin
Dado uma consulta a uma tabela com organization_id executada fora de withTenantContext
Quando a consulta roda contra o banco
Então zero linhas são devolvidas
E nenhuma linha de outro tenant é lida
```

**Cenário 5 — audit_logs isola por tenant no banco**
```gherkin
Dado registros de auditoria das organizações A e B
Quando app.current_org_id é definido como A
Então apenas os registros de A são visíveis
E remover a policy da tabela faz o teste falhar
```

**Cenário 6 — Tenant enviado pelo cliente é rejeitado**
```gherkin
Dado um gestor autenticado da organização A
Quando ele envia organizationId no corpo de POST /v1/members
Então a resposta é 422 com código VALIDATION_ERROR
E details aponta organizationId como campo não aceito
```

**Cenário 7 — Cota compartilhada entre instâncias**
```gherkin
Dado duas instâncias do api-core apontando para o mesmo Redis
E um usuário que já consumiu a cota biométrica na instância 1
Quando ele requisita POST /v1/biometric-verifications na instância 2
Então a resposta é 429 com código RATE_LIMIT_EXCEEDED
E o header Retry-After está presente
```

**Cenário 8 — Redis indisponível nega**
```gherkin
Dado o Redis inalcançável
Quando um gestor requisita POST /v1/biometric-verifications
Então a resposta é 503 com código RATE_LIMITER_UNAVAILABLE
E nenhuma requisição alcança o use-case
```

**Cenário 9 — A rota do dispositivo tem cota**
```gherkin
Dado um dispositivo autenticado que já enviou 5 capturas no mesmo segundo
Quando ele envia a sexta captura
Então a resposta é 429 com código RATE_LIMIT_EXCEEDED
E nenhum job é publicado na fila
```

**Cenário 10 — A rota do dispositivo tem teto de payload**
```gherkin
Dado um dispositivo autenticado
Quando ele envia frameBase64 com 1048577 bytes
Então a resposta é 413 com código PAYLOAD_TOO_LARGE
E o corpo da requisição não aparece em nenhuma linha de log
```

**Cenário 11 — Coleção é limitada e paginada**
```gherkin
Dado uma organização com 240 membros
Quando um gestor requisita GET /v1/members sem parâmetros
Então items contém 50 entradas
E page.nextCursor não é nulo
E requisitar com limit=101 responde 422
```

**Cenário 12 — Cursor inválido é recusado**
```gherkin
Dado um gestor autenticado
Quando ele requisita GET /v1/members?cursor=nao-e-um-cursor
Então a resposta é 400 com código INVALID_CURSOR
E nenhuma linha é lida
```

**Cenário 13 — Erro carrega correlation id**
```gherkin
Dado um cliente que envia X-Correlation-Id com um UUID válido
Quando a requisição falha por qualquer motivo
Então o mesmo valor aparece no header X-Correlation-Id da resposta
E o mesmo valor aparece em error.correlationId
E o mesmo valor aparece na linha de log da requisição
```

**Cenário 14 — Erro não ecoa a requisição**
```gherkin
Dado uma requisição biométrica malformada
Quando o servidor responde com erro
Então nem frameBase64, nem SQL, nem caminho de arquivo, nem nome de host aparecem na resposta
```

**Cenário 15 — Campo desconhecido é rejeitado**
```gherkin
Dado um gestor autenticado
Quando ele envia um campo não previsto no corpo de PATCH /v1/members/{memberId}
Então a resposta é 422 com código VALIDATION_ERROR
E o membro não é alterado
```

**Cenário 16 — Todas as violações de validação vêm de uma vez**
```gherkin
Dado um corpo com três campos inválidos
Quando a requisição é validada
Então details contém as três violações
E cada uma nomeia o campo e a regra quebrada
```

**Cenário 17 — Configuração incompleta impede o boot**
```gherkin
Dado o ambiente sem uma das variáveis obrigatórias
Quando o processo é iniciado
Então ele encerra com erro nomeando a variável ausente e o formato esperado
E nenhuma porta é aberta
```

**Cenário 18 — Nenhum arquivo lê o ambiente fora do módulo de configuração**
```gherkin
Dado o código-fonte de apps/api-core
Quando process.env é procurado fora de shared/infra/env
Então nenhuma ocorrência é encontrada
E a verificação roda no gate
```

**Cenário 19 — Cadastro biométrico não persiste imagem**
```gherkin
Dado um gestor e uma captura de qualidade suficiente
Quando ele requisita POST /v1/biometric-profiles
Então a resposta é 201 com Location do perfil criado
E um registro de auditoria é criado sem o quadro
E frameBase64 não aparece em nenhuma tabela nem em nenhuma linha de log
```

**Cenário 20 — Perfil anterior é desativado no mesmo cadastro**
```gherkin
Dado um membro com perfil biométrico ativo
Quando um novo cadastro é feito para o mesmo membro e o mesmo modelo
Então o perfil anterior fica inativo
E os dois efeitos acontecem na mesma transação
```

**Cenário 21 — Revogação inutiliza o vetor**
```gherkin
Dado um perfil biométrico ativo
Quando um gestor requisita DELETE /v1/biometric-profiles/{profileId}
Então a coluna face_embedding fica nula
E a próxima verificação do mesmo rosto responde NO_MATCH
E a revogação fica auditável
```

**Cenário 22 — O embedding nunca sai na resposta**
```gherkin
Dado um gestor autenticado
Quando ele requisita GET /v1/biometric-profiles
Então nenhuma entrada contém o vetor de embedding
E remover o campo da projeção não altera nenhuma resposta
```

**Cenário 23 — Verificação devolve rótulo em inglês**
```gherkin
Dado uma captura que corresponde a um membro com confiança entre os dois limiares
Quando um gestor requisita POST /v1/biometric-verifications
Então result é POSSIBLE
E nenhum valor de enum acentuado aparece em resposta alguma da API
```

**Cenário 24 — O caminho legado responde 404**
```gherkin
Dado um cliente que ainda chama /v1/face/enroll ou /v1/biometric/
Quando a requisição chega
Então a resposta é 404
E nenhum alias temporário existe
```

**Cenário 25 — Turma é criada com professor responsável**
```gherkin
Dado um gestor autenticado
Quando ele cria uma turma com professorId de um membro com papel professor
Então a resposta é 201 com Location da turma
E criar outra turma com o mesmo code responde 409 com código CLASS_CODE_TAKEN
```

**Cenário 26 — Matrícula é idempotente**
```gherkin
Dada uma turma e um membro do mesmo tenant
Quando o gestor requisita PUT do mesmo enrollment duas vezes
Então a primeira responde 201 e a segunda 200
E existe exatamente uma matrícula
```

**Cenário 27 — Professor alcança apenas as próprias turmas**
```gherkin
Dado um professor responsável pela turma A
Quando ele requisita GET /v1/classes
Então apenas a turma A aparece
E GET da turma B, com o identificador correto, responde 404
```

**Cenário 28 — professorId não é aceito do cliente**
```gherkin
Dado um professor autenticado
Quando ele envia professorId no corpo de POST /v1/attendance/sessions
Então a resposta é 422 com código VALIDATION_ERROR
E nenhuma sessão é criada
```

**Cenário 29 — Sessão aberta é recuperável**
```gherkin
Dado um professor com uma sessão aberta
Quando ele requisita GET /v1/attendance/sessions?status=open de outro dispositivo
Então a sessão em andamento aparece
E ele consegue fechá-la a partir dela
```

**Cenário 30 — Fechar sessão exige If-Match**
```gherkin
Dada uma sessão aberta
Quando o PATCH é enviado sem If-Match
Então a resposta é 428 com código PRECONDITION_REQUIRED
E com um If-Match obsoleto a resposta é 412 com código PRECONDITION_FAILED
E a sessão permanece aberta nos dois casos
```

**Cenário 31 — Sessão fechada recusa escrita**
```gherkin
Dada uma sessão já fechada
Quando um dispositivo envia uma captura para ela
Então a resposta é 409 com código SESSION_ALREADY_CLOSED
E nenhum registro é criado
```

**Cenário 32 — Presença é única por membro e sessão**
```gherkin
Dada uma sessão aberta e um membro já registrado nela
Quando o dispositivo captura o mesmo membro de novo
Então a resposta é 200 com o registro existente
E existe exatamente um registro para o membro na sessão
```

**Cenário 33 — Quadro com mais de um rosto não registra**
```gherkin
Dada uma sessão aberta
Quando o dispositivo envia um quadro com dois rostos
Então a resposta é 422 com código MULTIPLE_FACES
E nenhuma presença é registrada
E o desfecho fica auditável
```

**Cenário 34 — Foto impressa não registra presença**
```gherkin
Dada uma sessão aberta
Quando o dispositivo envia a captura de uma foto impressa
Então a resposta é 422 com código LIVENESS_CHECK_FAILED
E nenhuma presença é registrada
E a tentativa fica auditável
```

**Cenário 35 — Registro manual é distinguível do automático**
```gherkin
Dada uma sessão aberta e um membro matriculado na turma
Quando o professor requisita PUT do registro do membro
Então recognitionMethod é manual
E o mesmo PUT repetido responde 200 sem criar duplicata
E o relatório distingue manual de automático
```

**Cenário 36 — Registro manual exige matrícula**
```gherkin
Dada uma sessão de uma turma e um membro não matriculado nela
Quando o professor tenta registrá-lo manualmente
Então a resposta é 409 com código MEMBER_NOT_ENROLLED_IN_CLASS
E nenhum registro é criado
```

**Cenário 37 — Correção remove presença registrada por engano**
```gherkin
Dado um registro de presença existente numa sessão aberta
Quando o professor requisita DELETE do registro do membro
Então a resposta é 204
E o registro desaparece da listagem
E a remoção fica auditável com o membro e o autor
```

**Cenário 38 — A chamada preenche-se por polling condicional**
```gherkin
Dada uma sessão aberta e um ETag obtido na leitura anterior
Quando o portal requisita os registros com If-None-Match e nada mudou
Então a resposta é 304 sem corpo
E depois de um novo registro a mesma requisição responde 200 com ETag diferente
```

**Cenário 39 — Serviço de inferência indisponível degrada, não derruba**
```gherkin
Dado o circuito do ai-service aberto
Quando o dispositivo envia uma captura
Então a resposta é 503 com código AI_SERVICE_UNAVAILABLE e Retry-After
E o professor continua conseguindo registrar presença manualmente
E continua conseguindo fechar a sessão
```

**Cenário 40 — Relatório de frequência computa falta**
```gherkin
Dada uma turma com 10 matriculados e uma sessão com 7 presenças
Quando o gestor requisita GET /v1/reports/attendance da turma
Então cada matriculado aparece com presenças, faltas e percentual
E os 3 ausentes aparecem com 1 falta
```

**Cenário 41 — Recorte afetivo pequeno é suprimido**
```gherkin
Dado um recorte de bem-estar que resolve para 4 membros distintos
Quando ele é requisitado
Então o recorte aparece com suppressed true e valores nulos
E o recorte não é omitido da resposta
E baixar o mínimo de 5 para 1 faz o teste falhar
```

**Cenário 42 — O papel rh alcança só o agregado**
```gherkin
Dado um usuário com papel rh
Quando ele requisita GET /v1/reports/wellbeing
Então a resposta é 200
E qualquer requisição a members, classes, biometric-profiles, attendance ou audit-logs responde 403
```

**Cenário 43 — A trilha de auditoria é legível e imutável**
```gherkin
Dado um gestor autenticado
Quando ele requisita GET /v1/audit-logs
Então a coleção é paginada e filtrável por action, resourceType e período
E nenhuma rota permite alterar ou apagar um registro de auditoria
E nenhum payload contém frameBase64, embedding ou rótulo afetivo
```

**Cenário 44 — Retenção apaga o que venceu e preserva o resto**
```gherkin
Dado um perfil revogado há 31 dias e outro revogado há 29 dias
Quando o gestor requisita POST /v1/retention-runs
Então o de 31 dias é apagado e o de 29 permanece
E a auditoria da revogação de ambos permanece
E a resposta traz a contagem apagada por tipo
```

**Cenário 45 — O health público não vaza estado interno**
```gherkin
Dado um cliente não autenticado
Quando ele requisita GET /v1/health
Então a resposta contém apenas status ok
E GET /v1/health/dependencies responde 401 sem autenticação
```

**Cenário 46 — A fronteira modular é verificável**
```gherkin
Dado o código-fonte de apps/api-core
Quando um arquivo de domain importa framework, ORM, transporte ou outro módulo
Então o gate falha nomeando o arquivo e o import
E o mesmo vale para um módulo que importe o interior de outro módulo
```

**Cenário 47 — Nenhum use-case conhece o transporte**
```gherkin
Dado qualquer arquivo terminado em use-case
Quando suas assinaturas são inspecionadas
Então nenhum tipo de Elysia, TypeBox, Drizzle ou ioredis aparece
E o gate falha se um aparecer
```

**Cenário 48 — A fiação não usa estado mutável de módulo**
```gherkin
Dado o código-fonte de apps/api-core
Quando o padrão de singleton mutável de módulo é procurado
Então nenhuma ocorrência resta
E nenhum handler contém uma checagem de não inicializado
```

**Cenário 49 — Importação é parcial por linha**
```gherkin
Dado um lote de 10 membros em que a linha 3 tem e-mail inválido
Quando o gestor requisita POST /v1/member-imports
Então a resposta é 202 com o identificador da importação
E ao consultar a importação o status é completed
E 9 entradas têm status created e a linha 3 tem status rejected com errorCode
E os 9 membros existem no tenant
```

**Cenário 50 — A chave do dispositivo aparece uma única vez**
```gherkin
Dado um gestor autenticado
Quando ele requisita POST /v1/devices/{deviceId}/keys
Então a resposta é 201 e contém a chave em claro
E a chave anterior deixa de autenticar imediatamente
E nenhuma leitura posterior do dispositivo devolve chave alguma
E a chave não aparece em nenhuma linha de log nem em audit_logs
```

**Cenário 51 — Autenticação de dispositivo existe em ambiente migrado**
```gherkin
Dado um banco vazio ao qual todas as migrations do journal são aplicadas
Quando um dispositivo autentica com X-API-Key válida
Então a autenticação é bem-sucedida
E nenhum arquivo .sql do diretório de migrations está fora do _journal.json
```

**Cenário 52 — Lentidão de banco não vira indisponibilidade**
```gherkin
Dado uma query que demora mais que o limite de 5000 ms
Quando ela é executada por qualquer rota
Então ela é abortada e a rota responde erro tratado
E a conexão volta para o pool
E o mesmo vale para uma operação de Redis que exceda seu limite
```

---

## Fora de Escopo

- **RF-19, entrega do dado agregado ao sistema de RH.** A Q-02 nunca fechou e o ADR-0001 já decidiu que
  nenhum dado sai do Vultra antes de um ADR próprio. Formato, autenticação e base legal do canal precisam
  da outra equipe, que não participou desta decisão.
- **Integração com o sistema cadastral da instituição** (Q-04, terceira via). Exige instituição parceira e
  contrato de integração que não existem. O cadastro unitário e a importação em lote cobrem a demonstração.
- **Aplicativo e login de aluno.** O Vultra é ferramenta de gestão interna nesta entrega.
- **Ajuste dos três frontends ao contrato novo.** Fica para revisão e planejamento próprios. Enquanto isso,
  eles continuam quebrados como já estão hoje.
- **O pipeline de inferência do `ai-service`.** Já fechado pela SPEC-001 e pela epic #58. Esta spec consome
  aquele contrato, não o redefine.
- **Agendador de retenção.** A rota existe; quem a chama periodicamente é decisão de infraestrutura.
- **`GET /v1/biometric-profiles/{profileId}` individual.** A listagem filtrada por membro cobre todo uso
  conhecido; rota sem consumidor é superfície sem motivo.
- **Migração de dado existente.** Não há dado real no sistema (RNF-22). As migrations podem recriar.

---

## Quebra em Epics e Tasks

Cinco epics. A E1 é pré-requisito de todas as outras: ela estabelece as convenções que os módulos aplicam.
Dentro de cada epic, as tasks são fatias verticais — rota, use-case, persistência e teste na mesma entrega.

### E1 · #74 — Fundação transversal

| # | Issue | Task | Escopo | Critério | Depende de |
| --- | --- | --- | --- | --- | --- |
| 1 | #79 | Módulo único de ambiente com falha no boot | `shared/infra/env` | Cenários 17, 18 | — |
| 2 | #80 | Forma de erro, correlation id e handler global | `shared/infra/http` | Cenários 13, 14, 16 | 1 |
| 3 | #81 | Guard de autorização default-DENY com falha no boot | `shared/infra/http` | Cenários 1, 2 | 2 |
| 4 | #82 | Rate limiting em Redis falhando fechado | `shared/infra/http` | Cenários 7, 8 | 1, 2 |
| 5 | #83 | Envelope de coleção, cursor e validação de limite | `shared/kernel` | Cenários 11, 12 | 2 |
| 6 | #84 | RLS em `audit_logs` e `organizations` | migration | Cenários 4, 5 | — |
| 7 | #87 | Camada de teste contra Postgres real | `shared/infra` | Cenários 4, 5, 41 falham com o guard removido | 6 |
| 8 | #85 | Gate de fronteira modular e de transporte em use-case | ferramental | Cenários 46, 47, 48 | — |
| 30 | #86 | Timeout em toda operação de banco e de Redis | `shared/infra/database`, `shared/infra/redis` | Cenário 52 | 1 |

### E2 · #75 — Reestruturação modular e `identity`

| # | Issue | Task | Escopo | Critério | Depende de |
| --- | --- | --- | --- | --- | --- |
| 9 | #88 | Esqueleto de módulos e raiz de composição por módulo | `modules/`, `main.ts` | Cenário 48 | E1 |
| 10 | #89 | Módulo `identity` migrado com contrato novo | `modules/identity` | Cenários 3, 6, 11, 15 | 9 |
| 11 | #90 | Importação de membros em lote | `modules/identity` | Cenário 49 | 10 |
| 12 | #91 | Papéis finais: `rh` restrito, `student` sem login | `shared/infra/http`, `modules/identity` | Cenário 42 | 3, 10 |

### E3 · #76 — `classes` e `devices`

| # | Issue | Task | Escopo | Critério | Depende de |
| --- | --- | --- | --- | --- | --- |
| 13 | #92 | Modelo e migration de turma e matrícula | migration, `modules/classes` | Cenário 25 | E1 |
| 14 | #93 | Superfície de turma com escopo de professor | `modules/classes` | Cenários 25, 27 | 13, 12 |
| 15 | #94 | Matrícula idempotente | `modules/classes` | Cenário 26 | 14 |
| 16 | #95 | Módulo `devices` migrado, rotação como sub-recurso | `modules/devices` | Cenário 50 | 9 |
| 17 | #96 | Migration `0016` no journal | migration | Cenário 51 | — |

### E4 · #77 — `biometrics` e `attendance`

| # | Issue | Task | Escopo | Critério | Depende de |
| --- | --- | --- | --- | --- | --- |
| 18 | #97 | Módulo `biometrics` com caminho e enum novos | `modules/biometrics` | Cenários 19, 20, 21, 22, 23, 24 | 9, 4 |
| 19 | #98 | Módulo `attendance`: sessão com turma e leitura | `modules/attendance` | Cenários 28, 29 | 14, 18 |
| 20 | #99 | Fechamento de sessão com concorrência otimista | `modules/attendance` | Cenários 30, 31 | 19 |
| 21 | #100 | Registro automático com cota e teto de payload | `modules/attendance` | Cenários 9, 10, 32, 33, 34 | 19, 4 |
| 22 | #101 | Registro manual e correção | `modules/attendance` | Cenários 35, 36, 37 | 19 |
| 23 | #102 | Polling condicional com ETag na coleção de registros | `modules/attendance` | Cenário 38 | 21 |
| 24 | #103 | Degradação com o `ai-service` indisponível | `modules/attendance` | Cenário 39 | 21 |

### E5 · #78 — `reports`, `audit`, retenção e `health`

| # | Issue | Task | Escopo | Critério | Depende de |
| --- | --- | --- | --- | --- | --- |
| 25 | #104 | Relatório de frequência com falta computada | `modules/reports` | Cenário 40 | 15, 22 |
| 26 | #105 | Agregação afetiva com mínimo de grupo | `modules/reports` | Cenários 41, 42 | 25, 7 |
| 27 | #106 | Leitura da trilha de auditoria | `modules/identity` | Cenário 43 | 6, 12 |
| 28 | #107 | Execução de retenção com prazos declarados | `modules/identity` | Cenário 44 | 18, 22 |
| 29 | #108 | Health público sem estado interno | `shared/infra/http` | Cenário 45 | 3 |
