# 🏛️ Arquitetura Hexagonal — API Core

> **← [Voltar ao Backend](../README.md)**

O VULTRA adota a **Arquitetura Hexagonal (Ports & Adapters)**. O domínio é completamente isolado de detalhes de infraestrutura (HTTP, banco de dados, Redis). Isso permite testar o domínio sem subir nenhuma dependência externa.

---

## Estrutura de Pastas

```
src/
├── core/                          # Camada de Domínio (zero dependências externas)
│   ├── domain/
│   │   ├── entities/              # Entidades puras (Attendance, Member, Organization)
│   │   ├── value-objects/         # FaceEmbedding (vector 512), ConfidenceScore
│   │   └── errors/                # DomainError, AttendanceConflictError
│   └── use-cases/                 # Orquestradores de negócio
│       ├── RecordAttendanceUseCase.ts
│       ├── EnrollBiometricUseCase.ts
│       └── GenerateReportUseCase.ts
│
├── adapters/                      # Ports & Adapters
│   ├── http/
│   │   ├── routes/                # attendance.routes.ts, members.routes.ts, devices.routes.ts
│   │   ├── middleware/            # auth.middleware.ts, device.middleware.ts
│   │   └── schemas/               # TypeBox schemas por rota (attendance.schema.ts)
│   ├── repositories/              # AttendanceRepository, BiometricRepository, MemberRepository
│   └── queue/
│       └── AIJobQueue.ts          # Publica jobs no Redis para o AI Service
│
└── infrastructure/
    ├── server.ts                  # Bootstrap: Bun.serve() + Elysia
    ├── database.ts                # Conexão PostgreSQL (pg + pgvector)
    ├── redis.ts                   # Redis client
    └── container.ts               # Container de injeção de dependências (DI manual)
```

---

## Camadas e Responsabilidades

| Camada | Pasta | Pode importar de |
|--------|-------|-----------------|
| **Domain** | `core/domain/` | Nada externo |
| **Use Cases** | `core/use-cases/` | `core/domain/` + interfaces de ports |
| **Adapters** | `adapters/` | `core/` (via interfaces) + `infrastructure/` |
| **Infrastructure** | `infrastructure/` | Qualquer camada |

> **Regra cardinal:** `core/` nunca importa de `adapters/` nem de `infrastructure/`.  
> Se precisar de acesso ao banco, o Use Case recebe uma interface (`IAttendanceRepository`).  
> A implementação concreta fica em `adapters/repositories/`.

---

## Bootstrap do Servidor

O ponto de entrada em `infrastructure/server.ts` usa `Bun.serve()` com `fetch` delegado ao app ElysiaJS. A ordem de montagem dos plugins é obrigatória:

```
globalErrorHandler → authMiddleware → [rotas de domínio com prefixo /v1]
```

Todos os grupos de rotas recebem o prefixo `/v1` definido no nível do app.

---

## Design de Use Cases

Cada Use Case recebe suas dependências via construtor (injeção de interfaces, nunca implementations concretas). O método `execute()` é o único ponto público.

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

O contexto da requisição (usuário autenticado, organização ativa, cliente de banco) é injetado via `.derive()` do ElysiaJS — **nunca passado como parâmetro manual nos handlers**.

```typescript
// Padrão obrigatório — não passar contexto por parâmetro
.derive(async ({ headers, db }) => {
  const session = await auth.api.getSession({ headers });
  return { currentUser: session.user, currentOrg: session.activeOrg };
})
```
