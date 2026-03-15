# 🏛️ Arquitetura Hexagonal — API Core

> **← [Voltar ao Backend](../README.md)**

O VULTRA adota a **Arquitetura Hexagonal (Ports & Adapters)**. O domínio é completamente isolado de detalhes de infraestrutura (HTTP, banco de dados, Redis). Isso permite testar o domínio sem subir nenhuma dependência externa.

---

## Estrutura de Pastas

```
src/
├── main.ts                        # Entry point — app.listen(port)
│
├── core/                          # Camada de Domínio (zero dependências externas)
│   ├── domain/
│   │   └── errors/                # DomainError e subclasses (AttendanceConflictError, etc.)
│   └── use-cases/                 # Orquestradores de negócio (um arquivo por aggregate)
│       ├── attendance.use-cases.ts
│       ├── members.use-cases.ts
│       └── biometrics.use-cases.ts
│
├── adapters/                      # Ports & Adapters (implementações concretas)
│   ├── http/                      # Adapter de entrada (HTTP)
│   │   ├── auth.plugin.ts         # Plugin: currentUser + currentOrg via derive()
│   │   ├── device-auth.plugin.ts  # Plugin: X-Device-Token via derive()
│   │   ├── attendance.routes.ts   # Rotas /v1/attendance (TypeBox + handler)
│   │   ├── members.routes.ts      # Rotas /v1/members
│   │   └── devices.routes.ts      # Rotas /v1/devices
│   ├── repositories/              # Adapter de saída (PostgreSQL via Drizzle)
│   │   ├── attendance.repo.ts
│   │   ├── members.repo.ts
│   │   └── devices.repo.ts
│   └── queue/
│       └── ai-job.queue.ts        # Publica jobs no Redis para o AI Service
│
└── infrastructure/                # Configurações de servidor e dependências externas
    ├── server.ts                  # Composição ElysiaJS: plugins → CORS → /v1 routes
    ├── auth.ts                    # Better Auth (emailAndPassword, organization, RBAC)
    ├── error-handler.ts           # Plugin global .onError()
    └── database/
        ├── client.ts              # Drizzle ORM + withTenantContext()
        ├── migrations/            # SQL migrations numeradas
        └── schema/                # Definições de tabela por entidade
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
