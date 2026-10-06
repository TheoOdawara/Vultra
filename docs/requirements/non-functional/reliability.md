# REL — Confiabilidade

O comportamento do sistema quando uma parte dele falha.

<a id="nfr-rel-01"></a>
## NFR-REL-01 — Inferência indisponível é desfecho tratado

O sistema deve responder a uma captura com um desfecho de erro registrado quando o processamento de
inferência está indisponível, mantendo as demais operações no ar.

| Atributo | Valor |
| --- | --- |
| Rationale | A falha de uma parte não pode derrubar o resto nem deixar a câmera sem resposta |
| Source | Inferido na análise; aceito por Theo em 2026-10-06 |
| Priority | Must |
| Status | approved |
| Milestone | E1 |
| Since | v1.0.0 |

**Critérios de aceite**
- **NFR-REL-01.1** — Dada a inferência indisponível, quando a câmera envia capturas, então 100% delas
  recebem um desfecho de erro dentro do orçamento do
  [NFR-PERF-01](performance.md#nfr-perf-01), e cada uma fica registrada.
- **NFR-REL-01.2** — Dada a inferência indisponível, quando um gestor opera pessoas e câmeras, então
  100% dessas operações continuam respondendo.
