# 📊 Componentes de Visualização

> **← [Voltar ao RH](../README.md)**

---

## Biblioteca Base: Recharts

Todos os gráficos usam **Recharts**. Nunca misturar com outras bibliotecas de visualização no mesmo portal.

---

## Componentes

| Componente | Tipo Recharts | Descrição |
|------------|--------------|-----------|
| `SentimentTrendChart` | `LineChart` | Linhas por label (`happy`, `neutral`, `sad`, etc.) ao longo do tempo — cores fixas por sentimento |
| `AttendanceHeatmap` | Custom ou `ScatterChart` | Grade semanal de calor por taxa de presença (Seg–Sex × semanas) |
| `WellbeigGauge` | `RadialBarChart` | Score 0–100 do índice de bem-estar como gauge circular |
| `DepartmentComparisonBar` | `BarChart` | Comparação de índice entre departamentos —barras agrupadas |

---

## Cores Padrão por Sentimento

Cores fixas garantem consistência visual em todos os gráficos de sentimento:

| Label | Cor (hex) | Tailwind |
|-------|----------|---------|
| `happy` | `#22c55e` | `green-500` |
| `neutral` | `#94a3b8` | `slate-400` |
| `sad` | `#3b82f6` | `blue-500` |
| `angry` | `#ef4444` | `red-500` |
| `fear` | `#a855f7` | `purple-500` |
| `surprise` | `#f59e0b` | `amber-500` |
| `disgust` | `#78716c` | `stone-500` |

---

## Filtros Compartilhados

| Componente | Props |
|------------|-------|
| `DateRangePicker` | `value: { from: Date, to: Date }`, `onChange` |
| `DepartmentFilter` | `organizationId`, `value: string[]`, `onChange` |

Ambos utilizam o estado de URL (`searchParams`) para persistir filtros ao navegar entre páginas.
