# 📐 Estrutura do Portal RH

> **← [Voltar ao RH](../README.md)**

---

## Estrutura de Pastas

```
apps/frontend-rh/
├── src/
│   ├── app/
│   │   ├── (auth)/login/
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx                  # Overview de bem-estar
│   │   │   ├── attendance/
│   │   │   │   ├── page.tsx              # Relatório geral de presença
│   │   │   │   └── [memberId]/           # Histórico individual
│   │   │   ├── wellbeing/
│   │   │   │   ├── page.tsx              # Dashboard de sentimento agregado
│   │   │   │   └── trends/               # Tendências por período
│   │   │   ├── reports/
│   │   │   │   ├── page.tsx              # Central de relatórios exportáveis
│   │   │   │   └── [reportId]/           # Visualização de relatório
│   │   │   └── compliance/               # Conformidade de jornada
│   ├── components/
│   │   ├── charts/                       # SentimentTrendChart, AttendanceHeatmap, etc.
│   │   ├── filters/                      # DateRangePicker, DepartmentFilter
│   │   └── export/                       # ReportExporter (PDF/XLSX)
│   └── lib/
│       ├── auth-client.ts
│       ├── api.ts
│       └── report-formatters.ts
```

---

## Relatório Individual de Membro

Agrega por membro e período:

| Seção | Dados |
|-------|-------|
| Resumo | Total de sessões, presenças, faltas, taxa percentual, atrasos |
| Bem-estar | Sentimento dominante + histórico dia a dia (label + score) |
| Timeline | Lista cronológica com status (`present` \| `absent` \| `late`) e sentimento |

> `memberId` e `memberName` são exibidos — **nunca** `face_embedding` ou dados vetoriais brutos.

---

## Dashboard de Bem-Estar

Dados agregados por departamento retornam:

| Campo | Tipo |
|-------|------|
| `departmentId` / `departmentName` | string |
| `memberCount` | number |
| Breakdown por label | `{ happy%, neutral%, sad%, angry%, fear%, surprise%, disgust% }` |
| `wellbeingIndex` | number (0–100) |
| Tendência | `'improving'` \| `'stable'` \| `'declining'` |

> **Importante:** Dados de sentimento são sempre **médias agregadas por grupo** — nunca individuais identificáveis em contexto negativo.
