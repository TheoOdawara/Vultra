# Vultra Repository Structure

```
.
├── .gitignore
├── NEXT-STEPS.md
├── README.md
├── skills-lock.json
├── TODO.md
├── apps/
│   ├── ai-service/
│   │   └── .gitkeep
│   ├── api-core/
│   │   ├── biome.json
│   │   ├── drizzle.config.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── main.ts
│   │       ├── adapters/
│   │       │   ├── http/
│   │       │   │   ├── auth.plugin.ts
│   │       │   │   └── device-auth.plugin.ts
│   │       │   ├── queue/
│   │       │   │   └── .gitkeep
│   │       │   └── repositories/
│   │       │       └── .gitkeep
│   │       ├── core/
│   │       │   ├── domain/
│   │       │   │   └── errors/
│   │       │   │       └── DomainError.ts
│   │       │   └── use-cases/
│   │       │       └── .gitkeep
│   │       └── infrastructure/
│   │           ├── auth.ts
│   │           ├── error-handler.ts
│   │           ├── server.ts
│   │           └── database/
│   │               ├── client.ts
│   │               └── migrations/
│   │                   ├── 0001_init_extensions_uuid_v7.sql
│   │                   ├── 0002_create_organizations.sql
│   │                   ├── 0003_create_members.sql
│   │                   ├── 0004_create_devices.sql
│   │                   ├── 0005_create_biometric_profiles.sql
│   │                   ├── 0006_create_attendance_sessions.sql
│   │                   ├── 0007_create_attendance_records.sql
│   │                   ├── 0008_create_audit_logs.sql
│   │                   ├── 0009_create_hnsw_index.sql
│   │                   ├── 0010_simplify_attendance_records.sql
│   │                   ├── 0011_create_auth_core_tables.sql
│   │                   ├── 0012_create_auth_organization_tables.sql
│   │                   ├── 0013_create_auth_passkey_tables.sql
│   │                   ├── 0014_add_members_user_fk.sql
│   │                   └── meta/
│   │                       └── _journal.json
│   ├── frontend-admin/
│   │   └── .gitkeep
│   └── frontend-professores/
│       └── .gitkeep
├── docs/
│   ├── README.md
│   ├── backend/
│   │   ├── README.md
│   │   ├── adrs/
│   │   │   ├── ADR-001-typebox-sobre-zod.md
│   │   │   ├── ADR-002-arcface-modelo-padrao.md
│   │   │   ├── ADR-003-circuit-breaker-redis.md
│   │   │   └── ADR-004-estrutura-pastas-modularizacao.md
│   │   ├── arquitetura/
│   │   │   ├── circuit-breaker.md
│   │   │   ├── fila-redis.md
│   │   │   ├── hexagonal.md
│   │   │   └── processamento-ram.md
│   │   ├── guias/
│   │   │   ├── convencoes.md
│   │   │   ├── modelos-ia.md
│   │   │   └── seguranca-lgpd.md
│   │   └── manuais/
│   │       ├── autenticacao.md
│   │       ├── configuracao.md
│   │       ├── docker.md
│   │       └── error-handler.md
│   ├── database/
│   │   ├── README.md
│   │   ├── adrs/
│   │   │   └── ADR-001-pgvector-hnsw.md
│   │   ├── arquitetura/
│   │   │   ├── rls.md
│   │   │   ├── schema.md
│   │   │   └── versionamento-embeddings.md
│   │   ├── guias/
│   │   │   ├── multitenancy.md
│   │   │   └── queries-pgvector.md
│   │   └── manuais/
│   │       ├── indexacao.md
│   │       └── migrations.md
│   └── frontend/
│       ├── README.md
│       ├── admin/
│       │   ├── README.md
│       │   ├── arquitetura/
│       │   │   └── estrutura.md
│       │   ├── guias/
│       │   │   ├── dispositivos.md
│       │   │   └── kpis.md
│       │   └── manuais/
│       │       ├── autenticacao.md
│       │       └── componentes-ui.md
│       ├── professores/
│       │   ├── README.md
│       │   ├── arquitetura/
│       │   │   ├── estrutura.md
│       │   │   └── fluxo-chamada.md
│       │   ├── guias/
│       │   │   ├── diario.md
│       │   │   └── responsividade.md
│       │   └── manuais/
│       │       └── sessoes.md
│       └── rh/
│           ├── README.md
│           ├── arquitetura/
│           │   └── estrutura.md
│           ├── guias/
│           │   ├── alertas-bemestar.md
│           │   ├── exportacao.md
│           │   └── lgpd.md
│           └── manuais/
│               └── componentes-visualizacao.md
├── firmware/
│   └── esp32-cam/
│       └── .gitkeep
├── infra/
│   └── docker-compose.yml
└── packages/
    └── types/
        └── .gitkeep
```

## Notes
- This structure was auto-generated from the repository's file listing on Windows.
- Empty directories (marked with `.gitkeep`) are included.
- Database schema files are under `apps/api-core/src/infrastructure/database/schema/` (not listed individually in the snapshot but implied).

