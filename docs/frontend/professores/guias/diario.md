# 📓 Diário de Turma

> **← [Voltar ao Professores](../README.md)**

---

## Estrutura de uma Entrada de Diário

| Campo | Tipo | Observação |
|-------|------|------------|
| `sessionId` | UUID FK | Sessão vinculada |
| `classId` | UUID FK | Turma |
| `date` | DATE | Data da aula |
| `conteudo` | TEXT (HTML) | Rich text — **sanitizado no servidor** antes de persistir |
| `ocorrencias` | `Ocorrencia[]` | Lista de ocorrências do dia |

---

## Estrutura de uma Ocorrência

| Campo | Tipo | Valores |
|-------|------|---------|
| `memberId` | UUID | Aluno envolvido |
| `tipo` | enum | `'comportamento'` \| `'desempenho'` \| `'saude'` \| `'outro'` |
| `descricao` | TEXT | Descrição da ocorrência |
| `gravidade` | enum | `'baixa'` \| `'media'` \| `'alta'` |

---

## Componente `DiarioEditor`

Editor rich-text (baseado em Tiptap ou similares). O conteúdo é salvo via `auto-save` a cada 30s com debounce de 2s após a última digitação.

O endpoint de persistência é `PUT /v1/attendance/sessions/:id/diary` — idempotente, cria ou atualiza a entrada do dia.

---

## Segurança do Conteúdo Rich-Text

O HTML gerado pelo editor deve ser sanitizado **no servidor** antes de persistir — nunca confiar no HTML enviado pelo cliente diretamente. Usar uma whitelist de tags permitidas (p, ul, ol, li, strong, em, h3, br).
