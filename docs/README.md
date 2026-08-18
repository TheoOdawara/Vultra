# ⚡ VULTRA — Central de Documentação Técnica

> **⚠️ AVISO DE CONSULTA OBRIGATÓRIA**
> Todo membro da equipe, contribuidor ou sistema de IA **DEVE** consultar este hub e os documentos referenciados **ANTES** de propor qualquer alteração arquitetural, implementar uma nova feature ou modificar esquemas de banco de dados. O descumprimento desta política pode resultar em regressões de segurança, vazamentos de dados entre tenants ou violações à LGPD.

---

## 📌 Sobre o VULTRA

O **VULTRA** é um ecossistema SaaS Multitenant de ponta para **gestão de presenças** e **análise de bem-estar organizacional**, operando por meio de **reconhecimento facial** (biometria vetorial) e **análise de sentimento em tempo real**.

| Atributo            | Detalhe                                                       |
|---------------------|---------------------------------------------------------------|
| **Tipo**            | SaaS Multitenant (B2B)                                        |
| **Público-Alvo**    | Instituições de Ensino & Departamentos de RH                  |
| **Conformidade**    | LGPD (Lei nº 13.709/2018) — Nível Enterprise                  |
| **Rigor Acadêmico** | Iniciação Científica — padrões de engenharia rigorosos        |
| **Status**          | Em desenvolvimento ativo                                      |

---

## 🗺️ Mapa de Arquitetura do Sistema

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        VULTRA ECOSYSTEM                                  │
│                                                                          │
│  ┌──────────────────────────────────────────────────┐                    │
│  │              FRONTEND LAYER (React/Next.js)      │                    │
│  │  ┌───────────────┐ ┌───────────┐ ┌───────────┐   │                    │
│  │  │  Admin Portal │ │  RH Portal│ │Prof. Portal│  │                    │
│  │  │  (Gestão      │ │(Relatórios│ │(Chamada & │   │                    │
│  │  │   Global)     │ │ bem-estar)│ │  Diário)  │   │                    │
│  │  └───────┬───────┘ └─────┬─────┘ └─────┬─────┘   │                    │
│  └──────────┼───────────────┼─────────────┼─────────┘                    │
│             │               │             │                              │
│             └───────────────┼─────────────┘                              │
│                             │  REST / WebSocket                          │
│                             ▼                                            │
│  ┌──────────────────────────────────────────────┐                        │
│  │         API CORE (Bun + ElysiaJS)            │                        │
│  │                                              │                        │
│  │  ┌────────────┐  ┌──────────────────────┐    │                        │
│  │  │ Better Auth│  │  Hexagonal Adapters  │    │                        │
│  │  │ (RBAC/Org/ │  │  (Routes → Domain →  │    │                        │
│  │  │  Passkeys) │  │   Repositories)      │    │                        │
│  │  └────────────┘  └──────────────────────┘    │                        │
│  └──────────────────┬───────────────────────────┘                        │
│                     │                                                    │
│          ┌──────────┼──────────────────────┐                             │
│          │          │                      │                             │
│          ▼          ▼                      ▼                             │
│  ┌──────────────┐ ┌────────────┐  ┌───────────────────────┐              │
│  │  PostgreSQL  │ │   Redis    │  │  AI Microservice      │              │
│  │  + pgvector  │ │  (Queues)  │  │  (Python + FastAPI +  │              │
│  │  vector(512) │ │            │  │   InsightFace)        │              │
│  └──────────────┘ └────────────┘  └───────────────────────┘              │
│                                                                          │
│  ┌──────────────────────────────────────────────┐                        │
│  │         IoT LAYER (ESP32-CAM)                │                        │
│  │  Firmware C++/Arduino — Auth: X-Device-Token │                        │
│  └──────────────────────────────────────────────┘                        │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 📚 Índice da Documentação

Cada área possui a seguinte estrutura interna:  
`/arquitetura` — decisões estruturais e fluxos críticos  
`/manuais` — guias operacionais e de configuração  
`/guias` — padrões de código e convenções de contribuição  
`/adrs` — Architecture Decision Records (imutáveis)

### 🗄️ Camada de Dados
| Documento | Descrição | Prioridade |
|-----------|-----------|------------|
| [database/README.md](./database/README.md) | Índice — schemas, pgvector, multitenancy, indexação | **CRÍTICA** |

### ⚙️ Camada de Backend
| Documento | Descrição | Prioridade |
|-----------|-----------|------------|
| [backend/README.md](./backend/README.md) | Índice — API Core (Bun/ElysiaJS) + AI Service (FastAPI/InsightFace) | **CRÍTICA** |

### 🧠 Biometria Facial
| Documento | Descrição | Prioridade |
|-----------|-----------|------------|
| [face/README.md](./face/README.md) | Contratos canônicos `/v1/face/*`, thresholds, rate limiting, Redis + Circuit Breaker e LGPD | **CRÍTICA** |

### 🖥️ Camada de Frontend
| Documento | Descrição | Audiência |
|-----------|-----------|-----------|
| [frontend/README.md](./frontend/README.md) | Índice dos portais | Todos |
| [frontend/admin/README.md](./frontend/admin/README.md) | Portal de administração global | Admins VULTRA |
| [frontend/rh/README.md](./frontend/rh/README.md) | Relatórios de bem-estar | Gestores de RH |
| [frontend/professores/README.md](./frontend/professores/README.md) | Chamada em tempo real e diário | Professores |

---

## 🏛️ Princípios Arquiteturais Fundamentais

### 1. Multitenancy First
Toda query ao banco de dados **deve** incluir filtro por `organizationId`. Nenhuma exceção. Vazamento de dados entre tenants é classificado como **falha crítica de segurança (P0)**.

### 2. Segurança Biométrica (LGPD Art. 11)
```
PROIBIDO: Persistir imagens brutas no banco de dados
PERMITIDO: Apenas vetores numéricos float32[512] (embeddings)

Fluxo obrigatório:
  Imagem (ESP32-CAM) → RAM → InsightFace/ArcFace → vector(512) → PostgreSQL
                         ↑
              Imagem descartada aqui. Nunca persiste em disco.
```

### 3. Arquitetura Hexagonal — Separação de Camadas
```
src/
├── core/           ← Domain (Entidades, Value Objects, Use Cases)
│   ├── domain/
│   └── use-cases/
├── adapters/       ← Ports & Adapters (HTTP, DB, Redis, IoT)
│   ├── http/
│   ├── repositories/
│   └── queue/
└── infrastructure/ ← Config, DI Container, Server Bootstrap
```

### 4. Autenticação em Camadas
| Ator | Método | Header/Mecanismo |
|------|--------|-----------------|
| Usuário humano | JWT (Better Auth) | `Authorization: Bearer <token>` |
| Dispositivo ESP32 | Static API Key | `X-Device-Token: <key>` |
| Serviço interno | mTLS / shared secret | Var. ambiente |

---

## 🛠️ Stack Tecnológica Completa

```
┌─────────────────────────────────────────────────┐
│  Runtime     │ Bun ^1.x                         │
│  Framework   │ ElysiaJS ^1.x + TypeBox          │
│  Auth        │ Better Auth (Org, RBAC, Passkeys)│
│  Database    │ PostgreSQL 16 + pgvector 0.8     │
│  Cache/Queue │ Redis 7                          │
│  AI Engine   │ Python 3.11 + FastAPI + InsightFace │
│  Hardware    │ ESP32-CAM (C++/Arduino)          │
│  Deploy      │ Docker + Docker Compose          │
│  CI/CD       │ GitHub Actions                   │
│  Lint/Format │ Biome (TS) + Ruff (Python)       │
└─────────────────────────────────────────────────┘
```

---

## 🔄 Fluxo de Desenvolvimento

```
Issue → Branch feat/<nome> → Implementação → Testes → PR → Review → Merge
                                   │
                                   └── Atualizar /docs antes do merge
```

### Convenção de Commits (Obrigatório)
```
feat(attendance): implementa reconhecimento facial por vetor cosseno
fix(auth):        corrige validação de X-Device-Token em rotação de keys
docs(database):   adiciona diagrama ER do schema de embeddings
refactor(core):   extrai AttendanceUseCase para camada de domínio
chore(deps):      atualiza pgvector para 0.8.6
```

---

## 🔐 Política de Segurança e LGPD

| Requisito LGPD | Implementação VULTRA |
|----------------|----------------------|
| Minimização de dados (Art. 6, III) | Apenas embeddings vetoriais, sem imagens |
| Segurança no tratamento (Art. 46) | TLS 1.3 em todas as comunicações |
| Direito de exclusão (Art. 18, VI) | Soft delete com anonimização de vetores |
| Consentimento (Art. 7) | Termo explícito por tenant, versionado |
| Responsabilização (Art. 6, X) | Audit log imutável em tabela dedicada |

---

## 📋 Checklist Pré-Implementação

Antes de implementar qualquer feature, confirme:

- [ ] Li o `docs/README.md` e o documento específico da área
- [ ] A feature respeita o isolamento de `organizationId`
- [ ] Uso TypeBox (`t.Object()`) e não Zod/Joi
- [ ] Dados biométricos seguem o fluxo RAM-only
- [ ] As rotas possuem prefixo `/v1/`
- [ ] O deploy pode ser feito via Docker sem passos manuais
- [ ] Há um plano para atualizar a `/docs` após a conclusão

---

## 👥 Equipe e Contato

> Documentação mantida pelo **Arquitetos Principais do VULTRA**.
> Última revisão: **Maio de 2026**
