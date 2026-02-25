# ⚠️ Alertas de Bem-Estar

> **← [Voltar ao RH](../README.md)**

---

## Regras de Geração Automática

Alertas são gerados pela API Core com base nos dados de `attendance_records`. O portal os exibe na tela inicial do RH.

| Código da Regra | Critério | Severidade |
|-----------------|----------|------------|
| `SUSTAINED_NEGATIVITY` | Sentimento negativo (`sad`, `angry`, `fear`, `disgust`) > 40% em 3+ dias úteis consecutivos por membro | **Alta** |
| `ATTENDANCE_DROP` | Queda de taxa de presença > 15% comparado ao mês anterior, no mesmo departamento | **Média** |
| `EXTENDED_ABSENCE` | 0 presenças em 5+ dias úteis consecutivos por membro | **Alta** |

---

## Exibição de Alertas

O painel de alertas exibe os itens ordenados por severidade. Cada alerta contém:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `type` | string | Código da regra (`SUSTAINED_NEGATIVITY`, etc.) |
| `severity` | `'high'` \| `'medium'` | Severidade |
| `memberId` | UUID | Membro ou departamento afetado |
| `triggeredAt` | TIMESTAMPTZ | Quando o critério foi detectado |
| `resolvedAt` | TIMESTAMPTZ nullable | `null` se ainda ativo |

---

## Privacidade na Exibição

Alertas de `SUSTAINED_NEGATIVITY` nunca exibem os dados brutos de sentimento individualmente em listas públicas do departamento. O alerta é visível apenas para gestores de RH com permissão `reports:read` e ao próprio gestor direto do membro.
