# 📐 Estrutura do Portal de Professores

> **← [Voltar ao Professores](../README.md)**

---

## Estrutura de Pastas

```
apps/frontend-professores/
├── src/
│   ├── app/
│   │   ├── (auth)/login/
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx                       # Visão geral das turmas
│   │   │   ├── turmas/
│   │   │   │   ├── page.tsx                   # Lista de turmas
│   │   │   │   └── [turmaId]/
│   │   │   │       ├── page.tsx               # Detalhes e histórico
│   │   │   │       ├── chamada/page.tsx        # Chamada em tempo real
│   │   │   │       └── diario/page.tsx         # Diário de classe
│   │   │   └── relatorios/page.tsx             # Relatórios por turma
│   ├── components/
│   │   ├── chamada/
│   │   │   ├── LiveAttendancePanel.tsx         # Painel em tempo real (WebSocket)
│   │   │   ├── StudentCard.tsx                 # Card de aluno com status
│   │   │   ├── SessionControls.tsx             # Abrir/encerrar sessão
│   │   │   └── ManualOverride.tsx              # Marcar presença manual
│   │   ├── diario/
│   │   │   ├── DiarioEditor.tsx                # Editor rich-text
│   │   │   └── OcorrenciaForm.tsx
│   │   └── charts/
│   │       ├── TurmaAttendanceChart.tsx
│   │       └── StudentAttendanceCalendar.tsx
│   └── lib/
│       ├── auth-client.ts
│       ├── api.ts
│       └── websocket.ts                        # Hook useAttendanceWebSocket
```
