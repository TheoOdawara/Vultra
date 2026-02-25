# 🔍 Padrões de Query — pgvector e Relatórios

> **← [Voltar ao Database](../README.md)**

---

## Busca Vetorial por Cosseno (Reconhecimento Facial)

Este é o núcleo do sistema VULTRA. A query busca o membro mais similar ao embedding recebido do ESP32.

**Operador:** `<=>` (distância cosseno do pgvector)  
**Parâmetros:** `$1 = vector(512)`, `$2 = uuid organizationId`, `$3 = float threshold`  
**Retorno:** `memberId`, `similarity` (0–1), `model_version`

Estrutura da query:
1. `WHERE organization_id = $2` — isolamento de tenant obrigatório antes da busca vetorial
2. `AND model_version = $currentModel` — isola vetores do modelo ativo
3. `AND is_active = TRUE` — exclui perfis inativados ou pendentes de re-enrollment
4. `ORDER BY face_embedding <=> $1` — ordena por distância cosseno ascendente
5. `LIMIT 1` — apenas o match mais próximo
6. Filtrar na aplicação: `similarity >= $3` (threshold 0.85 para ArcFace)

> Nunca buscar sem o filtro `organization_id` + `model_version`. Ver [guias/multitenancy.md](./multitenancy.md) e [arquitetura/versionamento-embeddings.md](../arquitetura/versionamento-embeddings.md).

---

## Relatório de Presença por Sessão

Join entre `attendance_records` e `members`, filtrado por `organization_id` e `session_id`.

Colunas retornadas tipicamente: `member_id`, `member_name`, `external_code`, `recognition_method`, `confidence_score`, `sentiment_label`, `recorded_at`.  
Ordenação: `recorded_at ASC` para exibição cronológica.

---

## Taxa de Presença por Período (Portal RH)

Agregação sobre `attendance_sessions` + `attendance_records` no período.

Estrutura:
1. Filtra sessões pelo período (`started_at BETWEEN $dateFrom AND $dateTo`) e `organization_id`
2. Join com `attendance_records` por `session_id`
3. Agrupa por `member_id`
4. Calcula `COUNT(DISTINCT session_id) FILTER (WHERE attendance_record EXISTS)` / `COUNT(DISTINCT session_id)` como `attendance_rate_pct`

Retorno: `member_id`, `member_name`, `total_sessions`, `attended`, `attendance_rate_pct` (0–100).

---

## Agregado de Sentimento por Departamento (Portal RH)

Agrupa `attendance_records` por `class_id` (ou departamento) no período, calculando:
- Contagem e percentual de cada `sentiment_label`
- Score médio por label  
- `wellbeing_index` composto (lógica de score customizada por produto)

Retorno: `department_id`, `member_count`, distribuição de sentimentos, `wellbeing_index`, tendência (`improving` | `stable` | `declining`).
