# PERF — Eficiência de desempenho

O tempo de uma captura até o resultado e o tamanho de galeria que o sistema sustenta.

<a id="nfr-perf-01"></a>
## NFR-PERF-01 — Latência da captura ao resultado

O sistema deve concluir o processamento de uma captura, do envio pela câmera ao resultado gravado,
dentro do orçamento de tempo que [OQ-03](../open-questions.md#oq-03) fixar, e tratar o estouro como um
desfecho registrado.

| Atributo | Valor |
| --- | --- |
| Rationale | A pessoa passa pela porta sem parar, e a latência é uma das medidas do artigo |
| Source | Theo, entrevista de 2026-10-06 |
| Priority | Must |
| Status | approved |
| Milestone | E1 |
| Since | v1.0.0 |

**Critérios de aceite**
- **NFR-PERF-01.1** — Dada a medição do pipeline real nos dois ambientes, quando ela termina, então o
  orçamento em milissegundos é registrado aqui e [OQ-03](../open-questions.md#oq-03) é fechada.
- **NFR-PERF-01.2** — Dada uma captura que excede o orçamento, quando o tempo estoura, então o
  processamento é interrompido e o desfecho fica registrado; 0 capturas ficam sem desfecho.

<a id="nfr-perf-02"></a>
## NFR-PERF-02 — Galeria de 10.000 pessoas

O sistema deve manter o reconhecimento dentro do orçamento do [NFR-PERF-01](#nfr-perf-01) com 10.000
pessoas cadastradas em uma mesma instituição.

| Atributo | Valor |
| --- | --- |
| Rationale | É o tamanho de uma faculdade, o caso de uso real pretendido |
| Source | Theo, entrevista de 2026-10-06 |
| Priority | Must |
| Status | approved |
| Milestone | E1 |
| Since | v1.0.0 |

**Critérios de aceite**
- **NFR-PERF-02.1** — Dada uma instituição com 10.000 cadastros biométricos ativos, quando uma captura
  de reconhecimento é processada, então o tempo fica dentro do orçamento do NFR-PERF-01.
