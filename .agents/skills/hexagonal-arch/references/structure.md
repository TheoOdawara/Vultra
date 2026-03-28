# Estrutura de Pastas e Regras de Importação

## Mapa Completo de Pastas

```
apps/api-core/src/
├── core/                        ← Domínio puro — ZERO dependências externas
│   ├── domain/
│   │   ├── entities/            ← AttendanceRecord.ts, Member.ts, Device.ts…
│   │   ├── value-objects/       ← FaceEmbedding.ts, ConfidenceScore.ts…
│   │   └── errors/              ← DomainError.ts (base) + subclasses
│   ├── ports/                   ← Interfaces (contratos) que adapters implementam
│   │   ├── IBiometricRepository.ts
│   │   ├── IMemberRepository.ts
│   │   ├── IAttendanceRepository.ts
│   │   └── IAIQueueAdapter.ts
│   └── use-cases/               ← Um arquivo por caso de uso
│       ├── RecordAttendanceUseCase.ts
│       ├── EnrollBiometricUseCase.ts
│       ├── OpenAttendanceSessionUseCase.ts
│       ├── CloseAttendanceSessionUseCase.ts
│       └── GenerateReportUseCase.ts
├── adapters/
│   ├── http/
│   │   ├── routes/              ← *.routes.ts — ElysiaJS + TypeBox
│   │   ├── schemas/             ← *.schema.ts — t.Object() reutilizáveis
│   │   └── middleware/          ← auth, device-auth, global-error
│   ├── repositories/            ← Implementações Drizzle de I*Repository
│   │   ├── member.repository.ts
│   │   ├── biometric.repository.ts
│   │   └── attendance.repository.ts
│   └── queue/
│       └── AIJobQueue.ts        ← Implementação de IAIQueueAdapter (Redis + Circuit Breaker)
└── infrastructure/
    ├── server.ts                ← Bootstrap Elysia
    ├── database/                ← client.ts, schema/, migrations/
    ├── redis.ts                 ← instância Redis (ioredis)
    ├── auth.ts                  ← instância Better Auth
    └── container.ts             ← DI — instancia e injeta dependências
```

---

## Regras de Importação por Camada

| Camada | Pode importar de | Proibido importar de |
|--------|-----------------|---------------------|
| `core/domain/` | Apenas outras partes de `core/domain/` | Qualquer coisa externa |
| `core/ports/` | `core/domain/` | `adapters/`, `infrastructure/` |
| `core/use-cases/` | `core/domain/`, `core/ports/` | `adapters/`, `infrastructure/` |
| `adapters/` | `core/` (via ports), `infrastructure/` | Outros adapters diretamente |
| `infrastructure/` | Qualquer camada | — |

**Mnemônico:** A dependência sempre aponta para dentro (domínio). Nunca para fora.

---

## Teste Rápido de Violação

Se um arquivo em `core/` tem um `import` de um pacote externo (drizzle, ioredis, elysia, etc.), é uma violação de arquitetura. O único `import` externo permitido em `core/` é TypeScript puro.
