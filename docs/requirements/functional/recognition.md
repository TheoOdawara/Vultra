# REC — Reconhecimento

O que cada captura de reconhecimento deixa registrado.

<a id="fr-rec-01"></a>
## FR-REC-01 — Registrar evento de reconhecimento

> Como instituição, quero saber quem passou pela câmera e quando, para que a presença saia daí.

O sistema deve comparar o vetor de uma captura de reconhecimento com a galeria da instituição e, havendo
correspondência acima do limiar, gravar um evento com a pessoa, o instante, a câmera e a confiança.

| Atributo | Valor |
| --- | --- |
| Rationale | O evento é o produto direto do núcleo, e a presença do E2 é construída sobre ele |
| Source | Theo, entrevista de 2026-10-06 |
| Priority | Must |
| Status | approved |
| Milestone | E1 |
| Since | v1.0.0 |

**Critérios de aceite**
- **FR-REC-01.1** — Dada uma pessoa com cadastro ativo, quando a câmera a captura para reconhecimento,
  então é gravado um evento com essa pessoa, o instante, a câmera e a confiança.

<a id="fr-rec-02"></a>
## FR-REC-02 — Registrar evento sem identidade

> Como pesquisador, quero o registro das capturas que não reconheceram ninguém, para medir a taxa de erro.

O sistema deve gravar um evento sem pessoa, com o instante, a câmera e o motivo, quando uma captura de
reconhecimento não tem correspondência acima do limiar.

| Atributo | Valor |
| --- | --- |
| Rationale | Sem o desfecho negativo o sistema não mostra quantas capturas falharam, e o artigo não mede erro em uso real |
| Source | Theo, entrevista de 2026-10-06 |
| Priority | Must |
| Status | approved |
| Milestone | E1 |
| Since | v1.0.0 |

**Critérios de aceite**
- **FR-REC-02.1** — Dado um rosto sem cadastro na instituição, quando a câmera o captura, então é
  gravado um evento sem pessoa, com instante, câmera e motivo, e sem vetor.
