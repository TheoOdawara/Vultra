# 📐 Estrutura do Portal Admin

> **← [Voltar ao Admin](../README.md)**

---

## Estrutura de Pastas

```
apps/frontend-admin/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── 2fa/
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx          # Sidebar + header
│   │   │   ├── page.tsx            # Dashboard overview
│   │   │   ├── organizations/      # [super-admin] Gestão de tenants
│   │   │   ├── members/            # Membros da organização
│   │   │   ├── devices/            # ESP32-CAMs cadastrados
│   │   │   ├── roles/              # Gestão de permissões RBAC
│   │   │   ├── audit/              # Logs de auditoria
│   │   │   └── settings/           # Configurações do tenant
│   ├── components/
│   │   ├── ui/                     # Shadcn/UI primitives
│   │   ├── data-tables/            # Tabelas com filtro e paginação
│   │   ├── forms/
│   │   └── charts/                 # Recharts — métricas
│   ├── lib/
│   │   ├── auth-client.ts
│   │   ├── api.ts                  # Fetch wrapper tipado
│   │   └── query-client.ts         # TanStack Query config
│   └── types/
│       └── api.d.ts                # Tipos gerados da API
├── tailwind.config.ts
└── next.config.ts
```

---

## Módulos Principais

### Dashboard
Exibe cards de resumo (membros ativos, dispositivos, presenças hoje) + gráfico semanal + tabela de últimas sessões abertas.

### Gerenciamento de Membros

| Campo | Tipo | Observação |
|-------|------|------------|
| `name` | string | Nome completo |
| `email` | string | Login do portal |
| `externalCode` | string | Matrícula / RF |
| `role` | enum | `admin` \| `professor` \| `rh` \| `student` |
| `biometricEnrolled` | boolean | Readonly — gerenciado pelo IoT |

### Auditoria

Tabela `audit_logs` com filtros: período, `actorId`, `actorType`, `action`, `resourceType`. Paginação por cursor (baseada no `id` BIGSERIAL). **Sem botão de exclusão** — auditoria é somente leitura.
