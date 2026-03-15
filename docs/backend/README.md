# ⚙️ VULTRA — Backend

> **← [Voltar ao Hub Principal](../README.md)**
> **Área:** Backend (API Core + Microserviço de IA) | **Última revisão:** Fevereiro 2026

---

## Sobre esta seção

Esta seção cobre dois serviços distintos que operam em conjunto:

| Serviço | Stack | Responsabilidade |
|---------|-------|-----------------|
| **API Core** | Bun + ElysiaJS + Better Auth | Autenticação, lógica de negócio, persistência, WebSocket |
| **AI Service** | Python + FastAPI + DeepFace | Geração de embeddings faciais e análise de sentimento |

A comunicação entre os dois serviços é feita exclusivamente via **filas Redis** (sem chamadas HTTP diretas).

---

## Índice

### 🏛️ Arquitetura
Decisões estruturais, padrões de design e fluxos críticos do sistema.

| Documento | Conteúdo |
|-----------|----------|
| [arquitetura/hexagonal.md](./arquitetura/hexagonal.md) | Estrutura de pastas, camadas Hexagonal, design de Use Cases |
| [arquitetura/fila-redis.md](./arquitetura/fila-redis.md) | Protocolo de filas Redis entre API Core e AI Service |
| [arquitetura/processamento-ram.md](./arquitetura/processamento-ram.md) | Fluxo RAM-only, FaceService, Worker de embeddings |
| [arquitetura/circuit-breaker.md](./arquitetura/circuit-breaker.md) | Padrão Circuit Breaker para resiliência com Redis |

### 📖 Manuais
Guias operacionais e de configuração de cada serviço.

| Documento | Conteúdo |
|-----------|----------|
| [manuais/autenticacao.md](./manuais/autenticacao.md) | Better Auth, RBAC, autenticação de dispositivos IoT |
| [manuais/error-handler.md](./manuais/error-handler.md) | Handler global de erros e mapa de códigos HTTP |
| [manuais/docker.md](./manuais/docker.md) | Setup Docker para API Core e AI Service |
| [manuais/configuracao.md](./manuais/configuracao.md) | Variáveis de ambiente de ambos os serviços |

### 📌 Guias
Padrões de código, convenções e decisões técnicas para contribuidores.

| Documento | Conteúdo |
|-----------|----------|
| [guias/typebox-rotas.md](./guias/typebox-rotas.md) | Padrão de rota ElysiaJS com TypeBox |
| [guias/convencoes.md](./guias/convencoes.md) | Convenções de nomenclatura (arquivos, classes, rotas) |
| [guias/modelos-ia.md](./guias/modelos-ia.md) | Modelos de embedding disponíveis e critérios de seleção |
| [guias/seguranca-lgpd.md](./guias/seguranca-lgpd.md) | Regras de segurança biométrica e conformidade LGPD |

### 📋 ADRs (Architecture Decision Records)
Registro imutável das decisões arquiteturais e suas justificativas.

| Documento | Decisão |
|-----------|---------|
| [adrs/ADR-001-typebox-sobre-zod.md](./adrs/ADR-001-typebox-sobre-zod.md) | Uso de TypeBox em vez de Zod/Joi |
| [adrs/ADR-002-arcface-modelo-padrao.md](./adrs/ADR-002-arcface-modelo-padrao.md) | ArcFace como modelo padrão de embeddings |
| [adrs/ADR-003-circuit-breaker-redis.md](./adrs/ADR-003-circuit-breaker-redis.md) | Circuit Breaker na fila Redis |
| [adrs/ADR-004-estrutura-pastas-modularizacao.md](./adrs/ADR-004-estrutura-pastas-modularizacao.md) | Estrutura de pastas e modularização do monorepo |

---

## Regras Invioláveis

> Leia os documentos específicos para detalhes. Abaixo um resumo de alto nível.

1. **TypeBox obrigatório** — Zod, Joi e `any` são PROIBIDOS.
2. **Rotas com `/v1/`** — sem exceção.
3. **Imagens nunca persistidas** — apenas `vector(512)` no banco.
4. **`organizationId` em toda query** — vazamento entre tenants é P0.
5. **Circuit Breaker ativo** — API nunca bloqueia aguardando o AI Service indefinidamente.
