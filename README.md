# ⚡ VULTRA

**Ecossistema SaaS Multitenant para Gestão de Presenças com Reconhecimento Facial e Análise de Sentimento**

[![Status](https://img.shields.io/badge/status-em%20desenvolvimento-yellow?style=flat-square)](.)
[![Licença](https://img.shields.io/badge/licença-MIT-blue?style=flat-square)](./LICENSE)
[![Iniciação Científica](https://img.shields.io/badge/pesquisa-iniciação%20científica-purple?style=flat-square)](./docs/README.md)
[![LGPD](https://img.shields.io/badge/conformidade-LGPD%20Art.%2011-green?style=flat-square)](./docs/backend/guias/seguranca-lgpd.md)

</div>

---

## O que é o VULTRA?

O VULTRA é uma plataforma B2B multitenant que substitui chamadas manuais e controles de ponto tradicionais por **reconhecimento facial em tempo real** via câmeras IoT (ESP32-CAM). Cada rosto capturado gera um embedding vetorial que é comparado contra os perfis cadastrados no banco — sem jamais armazenar imagens (conformidade LGPD Art. 11).

Além da presença, o sistema analisa a **expressão facial** dos membros no momento do reconhecimento, gerando dados de bem-estar organizacional para equipes de RH.

| Atributo | Detalhe |
|----------|---------|
| **Tipo** | SaaS Multitenant (B2B) |
| **Público** | Instituições de Ensino & Departamentos de RH |
| **Conformidade** | LGPD Lei nº 13.709/2018 — Nível Enterprise |
| **Contexto** | Iniciação Científica |

---

## Arquitetura do Sistema

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          VULTRA ECOSYSTEM                                │
│                                                                          │
│   ┌─────────────────────────────────────────────────┐                    │
│   │            FRONTEND LAYER (Next.js 15)          │                    │
│   │   ┌─────────────┐  ┌──────────┐  ┌──────────┐  │                     │
│   │   │ Admin Portal│  │ RH Portal│  │Prof.Portal│  │                    │
│   │   │  (Tenants,  │  │(Relatórios│  │ (Chamada │  │                    │
│   │   │  Membros,   │  │bem-estar) │  │  & Diário│  │                    │
│   │   │  Dispositiv)│  └──────────┘  └──────────┘  │                     │
│   │   └─────────────┘                               │                    │
│   └──────────────────────┬──────────────────────────┘                    │
│                          │ REST / WebSocket                              │
│                          ▼                                               │
│   ┌──────────────────────────────────────────────┐                       │
│   │          API CORE  (Bun + ElysiaJS)          │                       │
│   │  Better Auth (RBAC, Organization, Passkeys)  │                       │
│   │  Arquitetura Hexagonal — Ports & Adapters    │                       │
│   └──────────┬─────────────────┬─────────────────┘                       │
│              │                 │                                         │
│       LPUSH  │          query  │  vector(<=>)                            │
│              ▼                 ▼                                         │
│   ┌─────────────┐    ┌──────────────────┐                                │
│   │    Redis    │    │   PostgreSQL 16  │                                │
│   │  (Filas de  │    │  + pgvector 0.8  │                                │
│   │    Jobs)    │    │   vector(512)    │                                │
│   └──────┬──────┘    └──────────────────┘                                │
│          │ BLPOP                                                         │
│          ▼                                                               │
│   ┌──────────────────────────────────┐                                   │
│   │    AI MICROSERVICE (Python)      │                                   │
│   │  FastAPI + DeepFace (ArcFace)    │                                   │
│   │  Processamento 100% em RAM       │                                   │
│   │  Embedding + Análise de Sentim.  │                                   │
│   └──────────────────────────────────┘                                   │
│                                                                          │
│   ┌──────────────────────────────────┐                                   │
│   │      IoT LAYER (ESP32-CAM)       │                                   │
│   │  Firmware C++/Arduino            │                                   │
│   │  Auth via X-Device-Token header  │                                   │
│   └──────────────────────────────────┘                                   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Stack Tecnológica

| Camada | Tecnologia |
|--------|------------|
| **Runtime** | [Bun](https://bun.sh) ^1.x |
| **API Framework** | [ElysiaJS](https://elysiajs.com) + TypeBox |
| **Autenticação** | [Better Auth](https://better-auth.com) (Organization, RBAC, Passkeys, MultiSession) |
| **Banco de Dados** | PostgreSQL 16 + [pgvector](https://github.com/pgvector/pgvector) 0.8 (pinado em `0.8.6-pg16-bookworm`) |
| **Fila / Cache** | Redis 7 |
| **AI Engine** | Python 3.11 + FastAPI + [DeepFace](https://github.com/serengil/deepface) (ArcFace) |
| **Frontend** | Next.js 15 (App Router) + Tailwind CSS 4 + Shadcn/UI |
| **IoT Firmware** | C++/Arduino (ESP32-CAM) |
| **Deploy** | Docker + Docker Compose |
| **CI/CD** | GitHub Actions |
| **Linting** | Biome (TypeScript) + Ruff (Python) |

---

## Funcionalidades Principais

### Reconhecimento Facial em Tempo Real
- Câmeras ESP32-CAM capturam frames e enviam via API
- Frames processados em RAM pelo microserviço Python — **nunca salvos em disco**
- Embedding ArcFace (512 dimensões) comparado via similaridade de cosseno no pgvector
- Threshold configurável (padrão 0.85 para ArcFace)

### Análise de Sentimento
- Expressão facial analisada no mesmo frame, durante o reconhecimento
- 7 labels: `happy`, `neutral`, `sad`, `angry`, `fear`, `surprise`, `disgust`
- Dados agregados por turma/departamento para dashboards de bem-estar do RH

### Três Portais Web
| Portal | Função |
|--------|--------|
| **Admin** | Gestão de tenants, membros, dispositivos ESP32 e RBAC |
| **RH** | Relatórios de presença, bem-estar e alertas automáticos |
| **Professores** | Chamada em tempo real com WebSocket + diário de turma |

### Multitenancy Enterprise
- Isolamento completo de dados por `organization_id`
- Row-Level Security (RLS) no PostgreSQL como segunda linha de defesa
- Circuit Breaker para resiliência quando o AI Service está indisponível

---

## Conformidade LGPD

A LGPD classifica dados biométricos como **dados sensíveis** (Art. 11), com regime especial de tratamento. O VULTRA foi projetado com privacidade-por-padrão:

| Princípio | Implementação |
|-----------|---------------|
| Minimização (Art. 6, III) | Somente embeddings `vector(512)` — zero imagens armazenadas |
| Segurança (Art. 46) | TLS 1.3 + RLS + bcrypt nos tokens de dispositivo |
| Exclusão (Art. 18, VI) | Soft delete com anonimização do vetor (`face_embedding = NULL`) |
| Consentimento (Art. 7) | Termo explícito por tenant, versionado |
| Responsabilização (Art. 6, X) | Audit log imutável (append-only) com todos os eventos |

> A violação da regra RAM-only (processar biometria em memória sem tocar disco) é classificada internamente como **Incidente de Segurança P0**.

---

## Documentação Técnica

A documentação completa está em [`/docs`](./docs/README.md) com a seguinte estrutura:

```
docs/
├── README.md                    ← Hub principal (leia primeiro)
├── backend/
│   ├── arquitetura/             Hexagonal, fila Redis, Circuit Breaker, RAM-only
│   ├── manuais/                 Autenticação, error handler, Docker, env vars
│   ├── guias/                   TypeBox, convenções, modelos de IA, LGPD
│   └── adrs/                    Architecture Decision Records
├── database/
│   ├── arquitetura/             Schema, versionamento de embeddings, RLS
│   ├── manuais/                 Migrations, indexação HNSW
│   ├── guias/                   Multitenancy, queries pgvector
│   └── adrs/
└── frontend/
    ├── admin/                   Gestão de tenants e dispositivos
    ├── rh/                      Relatórios e alertas de bem-estar
    └── professores/             Chamada em tempo real e diário
```

> **Atenção:** Consulte `/docs` antes de qualquer implementação. Decisões arquiteturais estão registradas nos ADRs.

---

## Estrutura do Repositório

O projeto está atualmente na **fase de arquitetura e documentação**. A estrutura de código será organizada como monorepo:

```
Vultra/
├── apps/
│   ├── api-core/                Bun + ElysiaJS
│   ├── ai-service/              Python + FastAPI + DeepFace
│   ├── frontend-admin/          Next.js 15
│   ├── frontend-rh/             Next.js 15
│   └── frontend-professores/    Next.js 15
├── firmware/
│   └── esp32-cam/               C++/Arduino
├── packages/
│   └── types/                   @vultra/types (TypeBox schemas compartilhados)
├── infra/
│   ├── docker-compose.yml
│   └── migrations/
└── docs/                        ← Documentação técnica completa
```

---

## Convenção de Commits

```
feat(attendance): implementa reconhecimento facial por vetor cosseno
fix(auth):        corrige validação de X-Device-Token em rotação de chaves
docs(database):   adiciona diagrama ER do schema de embeddings
refactor(core):   extrai RecordAttendanceUseCase para camada de domínio
chore(deps):      atualiza pgvector para 0.8.6
```

---

## Licença

Este projeto está licenciado sob a [MIT License](./LICENSE).

> Desenvolvido como projeto de **Iniciação Científica**
