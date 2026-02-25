# 🎨 Design System e Componentes de UI

> **← [Voltar ao Admin](../README.md)**

---

## Stack de UI

| Lib | Versão | Uso |
|-----|--------|-----|
| Tailwind CSS | 4.x | Utilities |
| Shadcn/UI | latest | Primitivos (Button, Table, Dialog, Badge...) |
| Recharts | 2.x | Gráficos de presença e tendências |
| TanStack Table | 8.x | Tabelas com sorting, filtering, pagination |
| React Hook Form | 7.x | Formulários validados |

---

## Componentes Customizados

| Componente | Pasta | Descrição |
|------------|-------|-----------|
| `DataTable<T>` | `components/data-tables/` | Tabela genérica com TanStack Table — sorting, filtros, paginação por cursor |
| `MemberForm` | `components/forms/` | Formulário de criação/edição de membro com validação |
| `DeviceEnrollCard` | `components/forms/` | Formulário de cadastro de ESP32 com exibição única da API key |
| `AttendanceChart` | `components/charts/` | Gráfico de barras semanal (Recharts) |
| `SystemHealthCard` | `components/ui/` | Card de status do AI Service (Circuit Breaker state) |

---

## Padrão de Uso dos Primitivos Shadcn

Primitivos são importados de `components/ui/` (gerados pelo Shadcn CLI). Nunca instalar versões alternativas dos mesmos componentes. Para customização, usar `cn()` do `lib/utils.ts` com classes Tailwind adicionais.

---

## Tokens de Cor por Status

| Status | Classe Tailwind | Contexto |
|--------|----------------|----------|
| Online / Sucesso | `text-green-600` | Dispositivos online, presenças confirmadas |
| Alerta | `text-yellow-600` | Match incerto (LOW_CONFIDENCE) |
| Erro / Offline | `text-red-600` | Dispositivos offline, falhas de reconhecimento |
| AI Degradado | `text-orange-500` | Circuit Breaker OPEN ou HALF-OPEN |
