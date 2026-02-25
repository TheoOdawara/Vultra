# 🖥️ Portal Administrativo

> **← [Voltar ao Frontend](../README.md)**
> **Audiência:** Super-admins VULTRA e administradores de organização

---

## Sobre

Centro de controle do ecossistema VULTRA. Gerencia organizações (tenants), membros, dispositivos ESP32 e permissões RBAC, além de monitorar a saúde do sistema em tempo real.

| Nível | Ator | Escopo |
|-------|------|--------|
| **Super Admin** | Equipe VULTRA | Todos os tenants e planos |
| **Org Admin** | Administrador do cliente | Apenas sua organização |

---

## Índice

| Documento | Conteúdo |
|-----------|----------|
| [arquitetura/estrutura.md](./arquitetura/estrutura.md) | Estrutura de pastas e módulos do portal |
| [manuais/autenticacao.md](./manuais/autenticacao.md) | Better Auth client, proteção de rotas |
| [manuais/componentes-ui.md](./manuais/componentes-ui.md) | Design system e stack de UI |
| [guias/kpis.md](./guias/kpis.md) | KPIs e métricas exibidas no dashboard |
| [guias/dispositivos.md](./guias/dispositivos.md) | Fluxo de cadastro de dispositivos ESP32 |
