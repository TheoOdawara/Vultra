# 🎛️ Controles de Sessão

> **← [Voltar ao Professores](../README.md)**
> Veja o fluxo completo em: [arquitetura/fluxo-chamada.md](../arquitetura/fluxo-chamada.md)

---

## Endpoints de Sessão

| Ação | Método + Endpoint | Body / Observação |
|------|------------------|-------------------|
| Abrir sessão | `POST /v1/attendance/sessions` | `{ classId, deviceId }` |
| Encerrar sessão | `PATCH /v1/attendance/sessions/:id/close` | Sem body |
| Override manual | `POST /v1/attendance/sessions/:id/records/manual` | `{ memberId, notes? }` |
| Listar sessões da turma | `GET /v1/attendance/sessions?classId=:id` | Paginado por cursor |

---

## Componente `SessionControls`

| Estado | Botões Visíveis | Ação |
|--------|----------------|------|
| Sem sessão | "Iniciar Chamada" | `POST .../sessions` |
| Sessão aberta | "Encerrar Chamada" + "Adicionar Manual" | `PATCH .../close` |
| Sessão encerrada | "Ver Relatório" | Navega para histórico |

O estado da sessão é sincronizado via `useQuery` com revalidação a cada 30s.

---

## Override Manual

O `ManualOverride` exibe um `Combobox` com os alunos da turma **ainda não marcados** na sessão. Ao confirmar:
1. Chama `POST .../records/manual` com `{ memberId, notes? }`
2. O registro é criado com `recognition_method = 'manual'` e `is_manual = TRUE`
3. O evento `PRESENCE_RECORDED` é emitido via WebSocket com `method: 'manual'` para atualizar o painel em tempo real

> O override manual não dispara o reconhecimento facial — nunca envolve o AI Service.
