# 🖥️ VULTRA — Frontend

> **← [Voltar ao Hub Principal](../README.md)**
> **Stack:** Next.js 15 + Tailwind CSS 4 + Shadcn/UI | **Última revisão:** Fevereiro 2026

---

## Portais

O VULTRA possui três portais web distintos, cada um com seu próprio App Next.js:

| Portal | Audiência | Funcionalidade Principal |
|--------|-----------|------------------------|
| [admin/](./admin/README.md) | Super-admins VULTRA e Admins de organização | Gestão de tenants, membros, dispositivos e RBAC |
| [rh/](./rh/README.md) | Gestores de RH e Analistas de Pessoas | Relatórios de presença e bem-estar |
| [professores/](./professores/README.md) | Professores e Coordenadores | Chamada em tempo real e diário de turma |

---

## Stack Compartilhada

| Lib | Versão | Uso |
|-----|--------|-----|
| Next.js | 15.x (App Router) | Framework base dos 3 portais |
| Tailwind CSS | 4.x | Utilities de estilo |
| Shadcn/UI | latest | Primitivos de UI |
| TanStack Query | 5.x | Server state + cache |
| React Hook Form | 7.x | Formulários |
| Better Auth Client | — | Auth compartilhado |
| TypeBox | mesmo da API | Tipos compartilhados via `@vultra/types` |

---

## Princípio de Privacidade

> Nenhum portal exibe dados biométricos brutos (vetores, imagens processadas). Apenas scores, labels e agregados são expostos na interface.

O `organizationId` do usuário autenticado é sempre a fonte do filtro — nunca lido de parâmetros de URL não validados.
