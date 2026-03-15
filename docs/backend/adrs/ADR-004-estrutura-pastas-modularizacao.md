# ADR-004 — Estrutura de Pastas e Modularização do Monorepo

**Status:** Aceito  
**Data:** Março de 2026  
**Contexto:** Necessidade de uma estrutura que suporte o crescimento do ecossistema VULTRA (SaaS Multitenant) sem gerar débito técnico ou complexidade excessiva ("ninho de pastas").

---

## Contexto

À medida que o projeto evolui, uma estrutura puramente por camadas técnicas (`infrastructure/`, `core/application/use-cases/attendance/OpenSessionUseCase.ts`) gera dificuldade de navegação: muitos arquivos com nomes genéricos em pastas profundas. O objetivo é manter a pureza da Arquitetura Hexagonal com uma estrutura de pastas navegável.

---

## Decisão

Adotamos um **Monorepo** com separação clara de responsabilidades por app, e dentro de cada app a estrutura segue as diretrizes abaixo:

### Backend — API Core (Hexagonal Simplificado)

Manter as camadas hexagonais, mas sem aninhamento excessivo dentro delas. Cada camada é uma pasta de **primeiro nível** dentro de `src/`. Os use-cases são agrupados por aggregate (não um arquivo por operação).

```
src/
├── main.ts
├── core/
│   ├── domain/errors/
│   └── use-cases/              ← um arquivo por aggregate, não por operação
├── adapters/
│   ├── http/                   ← flat: plugins e routes no mesmo nível
│   ├── repositories/
│   └── queue/
└── infrastructure/
    ├── server.ts
    ├── auth.ts
    ├── error-handler.ts
    └── database/
```

**Regra de dependência:**
```
adapters/http → core/use-cases → adapters/repositories → infrastructure/database
                               ↘ core/domain/errors
```

`core/` nunca importa de `adapters/` ou `infrastructure/`.

### Frontend — Portais Next.js (Feature-First)

Organizados por **feature** dentro de cada app Next.js. Componentes e lógicas que não são globais residem dentro de sua respectiva feature.

```
src/
├── app/                        ← Next.js App Router (Routes & Layouts)
├── features/
│   ├── attendance/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── services/
│   └── wellbeing/
├── components/ui/              ← Primitivos Shadcn/UI compartilhados
└── lib/                        ← Utilitários e Clientes (Auth/API)
```

### Compartilhamento — packages/

Uso da pasta `packages/` do monorepo para garantir *Single Source of Truth* entre portais:

| Pacote | Conteúdo |
|--------|----------|
| `packages/types` | Definições TypeBox compartilhadas |
| `packages/ui` | Design System base (Shadcn/UI) |
| `packages/utils` | Lógica de cálculo (ex: wellbeing index) |

---

## Consequências

**Positivas:**
- Alta testabilidade do domínio (`core/` sem dependências externas)
- Facilidade em adicionar novos portais ou features
- Isolamento de falhas biométricas no microserviço de IA
- Código "gritante": fácil de entender o que cada pasta faz
- Navegação por camada técnica no backend + por feature no frontend

**Negativas:**
- Requer rigor na gestão de dependências do monorepo (workspaces Bun)
- Leve aumento inicial no volume de arquivos

---

## Regras Invioláveis

- **Zero Imagem em Disco:** Processamento biométrico estritamente RAM-only (AI Service).
- **Multitenancy:** Toda operação filtra obrigatoriamente por `organizationId`.
- **TypeBox:** Única biblioteca permitida para schemas e validações (ADR-001).
- **`core/` puro:** Nunca importar de `adapters/` nem de `infrastructure/`.
- **Rotas com prefixo `/v1/`:** Sem exceção.
