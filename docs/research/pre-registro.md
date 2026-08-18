# Pré-registro — Busca vetorial multitenant sob isolamento por linha

> **Data da decisão:** 2026-08-12 (handoff de pesquisa)
> **Participantes:** Vinicius Larsen, Theo Odawara
> **Contexto:** Iniciação científica — paper sobre busca vetorial multitenant no Vultra
>
> **Natureza deste documento:** pré-registro. O hash e a data do commit que introduz
> este arquivo são a evidência de que o desenho experimental, as hipóteses e a regra
> de decisão foram fixados **antes** de qualquer corrida experimental. Alterações
> posteriores a este documento devem ser feitas em commits separados, justificadas,
> e reportadas no paper como desvios do pré-registro.

---

## 1. Questão de pesquisa e framing

**Framing escolhido (A):** busca vetorial multitenant sob isolamento por linha — impacto do Postgres Row-Level Security (RLS) sobre índices HNSW em reconhecimento facial 1:N (open-set), com avaliação em **taxas de erro biométrico** (FNIR/FPIR, ISO/IEC 19795-1), não em recall@k.

**Framing (B)** (arquitetura de referência LGPD Art. 11 em hardware de baixo custo) fica como *future work* — um parágrafo na discussão.

**Contribuição central:** traduzir a degradação do índice aproximado sob filtro de tenant em taxas de erro biométrico.

### Tese

```
FNIR(τ) = (1 − R) + R · FNIR_match(τ)
```

onde **R** = probabilidade de o índice retornar o mate (medida contra busca exata na galeria do tenant).

Consequências previstas:

1. O termo `(1 − R)` é independente do threshold → **piso de FNIR** que nenhum ajuste de τ recupera.
2. FPIR quase não muda (menos comparações impostoras pontuadas) → **degradação assimétrica**: a curva DET desloca para cima, não para a direita.
3. Quando o mate é perdido e um impostor intra-tenant passa de τ → **misidentificação** (presença marcada para a pessoa errada). Contada separadamente — é o modo de falha com consequência LGPD real.

---

## 2. Regra de decisão pré-registrada

- **A3 ≈ A4** → o efeito é de *índice compartilhado + filtro*, não de RLS. Retitular em torno de isolamento multitenant em índice compartilhado.
- **A3 ≠ A4** → achado específico de RLS. Título original se sustenta.

Títulos candidatos (decisão só após os resultados de A3 vs A4):

- **Principal (vale nos dois cenários):** "Do recall ao FNIR: quantificando o custo biométrico da busca vetorial aproximada sob isolamento multitenant em sistemas de presença conformes à LGPD"
- **Se A3 ≠ A4:** "O custo biométrico do Row-Level Security: como o isolamento de tenants em índices HNSW compartilhados impõe um piso de FNIR"
- **Inglês (submissão):** "From Recall Loss to FNIR Floors: The Biometric Cost of Tenant Isolation in Approximate Vector Search under Brazil's LGPD"

O abstract segue a estrutura **recall loss → piso de FNIR → assimetria na DET**, independente do título.

---

## 3. Desenho experimental

### Braços (6)

| Braço | Filtro de tenant |
|-------|------------------|
| A0 | Sem filtro (baseline) |
| A1 | `WHERE` com literal |
| A2 | `WHERE` parametrizado + `force_generic_plan` |
| A3 | `WHERE` com `current_setting('app.current_org_id')` |
| A4 | Política RLS (`ENABLE ROW LEVEL SECURITY`) |
| A5 | `FORCE ROW LEVEL SECURITY` |

O teste real de RLS é **A3 vs A4** (mesma expressão de filtro, com e sem o mecanismo de política).

### Topologias de índice (3)

1. HNSW global (índice único compartilhado — configuração atual do Vultra, migration 0009);
2. Índice parcial por tenant;
3. Particionado por tenant.

### Registrado por corrida

- recall@1 vs ground truth exato (busca por força bruta na galeria do tenant);
- FNIR / FPIR;
- latência;
- tipo de nó no `EXPLAIN` (index scan vs seq scan etc.).

### Controles

- `ef_search`, `iterative_scan`, query set e seed **fixos**;
- **≥ 5 repetições por célula** (braço × topologia);
- `iterative_scan` varrido em experimento separado (requer pgvector 0.8 — pin registrado no [ADR-002](../database/adrs/ADR-002-pin-pgvector-0.8.md));
- versão exata do pgvector, do PostgreSQL e todos os GUCs relevantes registrados junto aos resultados.

### Hipótese quantitativa

No HNSW global filtrado, **R degrada como função de (tamanho do tenant / N total) × ef_search**, com `iterative_scan` mitigando. No índice parcial por tenant, R volta ao recall nominal do HNSW.

---

## 4. Protocolo de avaliação biométrica (ISO/IEC 19795-1)

- **Mated probes** (pessoa presente na galeria do tenant) → FNIR.
- **Non-mated probes** → FPIR. Membros de **outros tenants** usados como probes contra a galeria do tenant A: testa erro biométrico e vazamento de isolamento no mesmo experimento.
- Métrica principal reportada: **FNIR @ FPIR = 0,01**, por braço × topologia.
- Decomposição de causa: `FNIR_obs − FNIR_exato ≈ (1 − R)(1 − FNIR_exato)` para atribuir a degradação a retrieval vs matcher.
- **Taxa de misidentificação** (rank-1 errado com score ≥ τ) reportada à parte.

---

## 5. Experimento complementar: churn LGPD

FNIR após X% de exclusões Art. 18 VI (`face_embedding = NULL`) **sem reindex** — mede o drift do grafo HNSW sob o fluxo real de revogação do Vultra.

---

## 6. Plano de execução (status no handoff de 2026-08-12)

| # | Ação | Status |
|---|------|--------|
| 1 | Pinar pgvector 0.8 no repo | Feito (ADR-002) |
| 2 | Pré-registro da regra de decisão no repo | Feito (este documento) |
| 3 | Ground truth por busca exata (força bruta) por galeria de tenant | Pendente |
| 4 | Dataset sintético de galerias/probes por tenant (mated + non-mated cross-tenant) | Pendente |
| 5 | Harness dos 6 braços × 3 topologias com métricas e EXPLAIN por corrida | Pendente |
| 6 | Varredura separada de iterative_scan | Pendente |
| 7 | Experimento de churn (Art. 18 VI) | Pendente |
| 8 | Rascunho do abstract (recall loss → piso de FNIR → assimetria) | Pendente |
| 9 | Decidir título final após resultados de A3 vs A4 | Bloqueado por 5 |

**Cadência:** call semanal para revisar progresso e destravar bloqueios.
