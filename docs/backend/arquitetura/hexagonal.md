# 🏛️ Arquitetura Hexagonal — API Core

> **← [Voltar ao Backend](../README.md)**

O VULTRA adota a **Arquitetura Hexagonal (Ports & Adapters)**. O domínio é completamente isolado de detalhes de infraestrutura (HTTP, banco de dados, Redis). Isso permite testar o domínio sem subir nenhuma dependência externa.

---

## Estrutura de Pastas

```
src/
├── main.ts                              # Entry point — app.listen(port)
│
├── core/                                # Camada de Domínio (zero dependências externas)
│   ├── domain/
│   │   ├── constants.ts                 # Thresholds biométricos (FACE_MATCH_THRESHOLD, etc.)
│   │   └── errors/
│   │       └── DomainError.ts           # Base + todas as subclasses de erro
│   ├── ports/                           # Interfaces (contratos) para infraestrutura
│   │   ├── IAIQueueAdapter.ts
│   │   ├── IAttendanceRepository.ts
│   │   ├── IAuditLogRepository.ts
│   │   ├── IBiometricRepository.ts
│   │   ├── IDeviceRepository.ts
│   │   ├── IMemberRepository.ts
│   │   └── IReportsRepository.ts
│   └── use-cases/                       # Orquestradores de negócio (um subdiretório por aggregate)
│       ├── attendance/
│       │   ├── CloseSessionUseCase.ts
│       │   ├── ManualRecordUseCase.ts
│       │   ├── OpenSessionUseCase.ts
│       │   ├── RecordAttendanceUseCase.ts
│       │   └── index.ts
│       ├── biometrics/
│       │   ├── EnrollBiometricUseCase.ts
│       │   ├── ListFacesUseCase.ts
│       │   ├── RevokeBiometricUseCase.ts
│       │   ├── VerifyFaceUseCase.ts
│       │   └── index.ts
│       ├── devices/
│       │   ├── DeactivateDeviceUseCase.ts
│       │   ├── ListDevicesUseCase.ts
│       │   ├── RegisterDeviceUseCase.ts
│       │   ├── RotateDeviceKeyUseCase.ts
│       │   ├── UpdateDeviceUseCase.ts
│       │   └── index.ts
│       ├── members/
│       │   ├── CreateMemberUseCase.ts
│       │   ├── DeactivateMemberUseCase.ts
│       │   ├── GetMemberUseCase.ts
│       │   ├── ListMembersUseCase.ts
│       │   ├── UpdateMemberUseCase.ts
│       │   └── index.ts
│       └── reports/
│           ├── GetAttendanceReportUseCase.ts
│           ├── GetWellbeingReportUseCase.ts
│           └── index.ts
│
├── adapters/                            # Ports & Adapters (implementações concretas)
│   ├── http/                            # Adapter de entrada (HTTP)
│   │   ├── middleware/
│   │   │   ├── auth.plugin.ts           # derive(): currentUser + currentOrg + currentRole
│   │   │   └── device-auth.plugin.ts    # derive(): authenticatedDevice via X-Device-Token
│   │   ├── routes/
│   │   │   ├── attendance.routes.ts     # /v1/attendance — user sessions
│   │   │   ├── biometric.routes.ts      # /v1/biometric/* (legado → 404)
│   │   │   ├── devices.routes.ts        # /v1/devices
│   │   │   ├── face.routes.ts           # /v1/face/*
│   │   │   ├── health.routes.ts         # /v1/health/ai-service
│   │   │   ├── members.routes.ts        # /v1/members
│   │   │   └── reports.routes.ts        # /v1/reports
│   │   └── schemas/                     # TypeBox schemas reutilizáveis por módulo
│   │       ├── attendance.schema.ts
│   │       ├── biometric.schema.ts
│   │       └── face.schema.ts
│   ├── repositories/                    # Adapter de saída (PostgreSQL via Drizzle)
│   │   ├── attendance.repository.ts
│   │   ├── audit-log.repository.ts
│   │   ├── biometric.repository.ts      # pgvector cosine similarity search
│   │   ├── device.repository.ts         # strip api_key_hash via toSnapshot()
│   │   ├── member.repository.ts
│   │   └── reports.repository.ts        # SQL raw via drizzle.execute(sql`...`)
│   └── queue/
│       └── ai-job.queue.ts              # Circuit Breaker + Redis LPUSH/result poll
│
└── infrastructure/                      # Configurações de servidor e dependências externas
    ├── server.ts                        # Composição ElysiaJS: plugins → CORS → /v1 routes
    ├── auth.ts                          # Better Auth + checkPermission()
    ├── container.ts                     # Singleton do AIJobQueue
    ├── error-handler.ts                 # Plugin global .onError()
    ├── redis.ts                         # Client Redis singleton
    └── database/
        ├── client.ts                    # Drizzle ORM + withTenantContext()
        ├── migrations/                  # SQL migrations numeradas (0001–0015)
        └── schema/                      # Definições de tabela por entidade
```

---

## Camadas e Responsabilidades

| Camada | Pasta | Pode importar de |
|--------|-------|-----------------|
| **Domain** | `core/domain/` | Nada externo |
| **Ports** | `core/ports/` | `core/domain/` apenas |
| **Use Cases** | `core/use-cases/` | `core/domain/` + `core/ports/` (interfaces) |
| **Adapters** | `adapters/` | `core/` (via interfaces) + `infrastructure/` |
| **Infrastructure** | `infrastructure/` | Qualquer camada |

> **Regra cardinal:** `core/` nunca importa de `adapters/` nem de `infrastructure/`.  
> Se precisar de acesso ao banco, o Use Case recebe uma interface (`IMemberRepository`).  
> A implementação concreta fica em `adapters/repositories/`.

---

## Bootstrap do Servidor

O ponto de entrada em `infrastructure/server.ts` compõe o app ElysiaJS. A ordem de montagem dos plugins é **obrigatória e inviolável**:

```
globalErrorHandler → CORS → mount(auth.handler) → grupo /v1 [rotas de domínio]
```

| Ordem | Plugin/Bloco | Motivo |
|-------|-------------|--------|
| 1 | `globalErrorHandler` | Captura erros de todos os plugins seguintes |
| 2 | `cors()` | Deve preceder auth para responder OPTIONS corretamente |
| 3 | `mount(auth.handler)` | Better Auth em `/api/auth/*` — sem prefixo adicional |
| 4 | `.group('/v1', ...)` | Todas as rotas de domínio com prefixo versionado |

Todos os grupos de rotas recebem o prefixo `/v1` definido no nível do app.

---

## Design de Use Cases

Cada Use Case recebe suas dependências via construtor (injeção de interfaces, nunca implementations concretas). O método `execute()` é o único ponto público.

### Padrão de inicialização (lazy singleton)

```typescript
// adapters/http/routes/members.routes.ts
let _list: ListMembersUseCase | null = null;

export function initMemberRoutes(): void {
  const memberRepo = new MemberRepository(db);
  _list = new ListMembersUseCase(memberRepo);
}
```

`initXxxRoutes()` é chamado no bootstrap do servidor, injetando a implementação concreta do repositório. O Use Case só conhece a interface `IMemberRepository`.

### Fluxo do `RecordAttendanceUseCase`

Este é o Use Case central do sistema. Orquestra o fluxo completo de reconhecimento:

```
1. Enfileira o frame no Redis → AI Service gera o embedding
2. Aguarda o resultado (vector + sentimento) via Redis result key
3. Busca o membro mais próximo por similaridade cosseno no pgvector
4. Verifica se já há registro para esse membro na sessão (evita duplicata → HTTP 409)
5. Persiste o attendance_record (sem imagem — apenas metadados e scores)
```

Interfaces consumidas pelo Use Case:

| Interface (Port) | Responsabilidade |
|------------------|-----------------|
| `IAIQueueAdapter` | Enfileira job + aguarda resultado do embedding |
| `IBiometricRepository` | Busca por similaridade cosseno no pgvector |
| `IAttendanceRepository` | Verifica duplicata e persiste o registro |

---

## Injeção de Contexto via `derive`

O contexto da requisição (usuário autenticado, organização ativa, role) é injetado via `.derive()` do ElysiaJS — **nunca passado como parâmetro manual nos handlers**.

```typescript
// Padrão obrigatório — não passar contexto por parâmetro
.derive(async ({ headers, db }) => {
  const session = await auth.api.getSession({ headers });
  return {
    currentUser: session.user,
    currentOrg: session.activeOrg,
    currentRole: memberRow.role,
  };
})
```

---

## Erros de Domínio por Módulo

Cada módulo define seus próprios erros no próprio arquivo de Use Case. A base `DomainError` fica em `core/domain/errors/DomainError.ts`.

| Módulo | Erro | HTTP | Código |
|--------|------|------|--------|
| Auth | `UnauthorizedError` | 401 | `UNAUTHORIZED` |
| Auth | `ForbiddenError` | 403 | `INSUFFICIENT_PERMISSIONS` |
| Auth | `InvalidDeviceTokenError` | 401 | `INVALID_DEVICE_TOKEN` |
| Tenant | `OrganizationNotFoundError` | 404 | `ORGANIZATION_NOT_FOUND` |
| Attendance | `SessionNotFoundError` | 404 | `SESSION_NOT_FOUND` |
| Attendance | `SessionAlreadyClosedError` | 409 | `SESSION_ALREADY_CLOSED` |
| Attendance | `AttendanceConflictError` | 409 | `ATTENDANCE_CONFLICT` |
| Face | `FaceNotRecognizedError` | 404 | `FACE_NOT_RECOGNIZED` |
| Face | `LowConfidenceMatchError` | 422 | `LOW_CONFIDENCE_MATCH` |
| Face | `LowQualityFrameError` | 422 | `LOW_QUALITY` |
| Biometrics | `BiometricProfileNotFoundError` | 404 | `BIOMETRIC_PROFILE_NOT_FOUND` |
| Biometrics | `BiometricEnrollConflictError` | 409 | `BIOMETRIC_ENROLL_CONFLICT` |
| Biometrics | `PayloadTooLargeError` | 413 | `PAYLOAD_TOO_LARGE` |
| Biometrics | `RateLimitExceededError` | 429 | `RATE_LIMIT_EXCEEDED` |
| AI | `AIServiceUnavailableError` | 503 | `AI_SERVICE_UNAVAILABLE` |
| AI | `AIJobTimeoutError` | 503 | `AI_SERVICE_UNAVAILABLE` |
| Members | `MemberNotFoundError` | 404 | `MEMBER_NOT_FOUND` |
| Members | `MemberExternalCodeConflictError` | 409 | `MEMBER_EXTERNAL_CODE_CONFLICT` |
| Devices | `DeviceNotFoundError` | 404 | `DEVICE_NOT_FOUND` |
| Reports | `InvalidReportRangeError` | 422 | `INVALID_REPORT_RANGE` |
