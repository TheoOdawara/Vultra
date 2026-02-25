# 📤 Exportação de Relatórios

> **← [Voltar ao RH](../README.md)**

---

## Formatos Suportados

| Formato | Biblioteca | Conteúdo Exportado |
|---------|-----------|-------------------|
| **PDF** | `react-pdf` + Puppeteer | Relatório formatado com gráficos renderizados |
| **XLSX** | `xlsx` (SheetJS) | Dados tabulares para análise no Excel |
| **CSV** | Nativo (API) | Exportação simples de presenças — sem gráficos |

---

## Fluxo do Componente `ReportExporter`

1. Usuário seleciona formato e período no painel de filtros
2. Clica em exportar → estado `exporting = true` desabilita os botões
3. Chamada `GET /v1/reports/{type}/export?format={format}&from={date}&to={date}`
4. API retorna um blob (PDF, XLSX ou CSV)
5. Frontend faz download via `URL.createObjectURL(blob)` + `<a>.click()`
6. Estado `exporting = false` reabilita os botões

---

## Tipos de Relatório Exportável

| Tipo | Endpoint | Descrição |
|------|----------|-----------|
| `attendance` | `/v1/reports/attendance/export` | Planilha de presenças por período |
| `wellbeing` | `/v1/reports/wellbeing/export` | Resumo de bem-estar por departamento |
| `individual` | `/v1/reports/individual/{memberId}/export` | Relatório completo de um membro |
| `compliance` | `/v1/reports/compliance/export` | Conformidade de jornada |
