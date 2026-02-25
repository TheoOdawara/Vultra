# 📱 Responsividade e Controle de Acesso

> **← [Voltar ao Professores](../README.md)**

---

## Responsividade

O portal é otimizado para uso em **tablet em sala de aula** — o professor monitora a chamada enquanto leciona.

| Breakpoint | Dispositivo | Adaptações |
|------------|-------------|------------|
| `sm` (640px) | Mobile | Menu hambúrguer, cards empilhados |
| `md` (768px) | **Tablet** ← uso primário | Grid 2 colunas, `LiveAttendancePanel` ocupa tela cheia |
| `lg` (1024px) | Desktop | Layout completo, sidebar fixa |

O componente `LiveAttendancePanel` deve ter layout diferente em `md`: cards de alunos em 2 colunas, controles de sessão no topo fixo.

---

## Controle de Acesso

| Operação | `professor` | `coordenador` |
|----------|:-----------:|:-------------:|
| Abrir/encerrar sessão | ✅ (próprias turmas) | ✅ (todas) |
| Ver chamada em tempo real | ✅ | ✅ |
| Override manual de presença | ✅ | ✅ |
| Escrever no diário | ✅ | ✅ |
| Ver relatórios da turma | ✅ | ✅ |
| Editar registros de outros professores | ❌ | ✅ |
| Exportar dados em massa | ❌ | ✅ |

---

## Comportamento quando AI Service está Indisponível

Quando o Circuit Breaker do AI Service estiver `OPEN`, o `LiveAttendancePanel` deve:

1. Exibir banner de aviso: *"Reconhecimento facial temporariamente indisponível. Use registro manual."*
2. Destacar o botão "Adicionar Manual" com indicador visual
3. **Não** esconder ou desabilitar a tela de chamada — o professor deve continuar operando via override manual
