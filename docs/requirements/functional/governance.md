# GOV — Governança

O rastro que toda operação sobre dado biométrico deixa.

<a id="fr-gov-01"></a>
## FR-GOV-01 — Auditar operação biométrica

> Como instituição, quero o registro de toda operação sobre dado biométrico, para responder quem fez o quê.

O sistema deve gravar um registro de auditoria imutável para cada operação sobre dado biométrico,
incluindo as que falham e as automáticas, com quem, quando e sobre qual recurso, sem o conteúdo.

| Atributo | Valor |
| --- | --- |
| Rationale | Dado sensível exige responsabilização, e o rastro com o conteúdo seria uma segunda cópia do dado |
| Source | Theo, entrevista de 2026-10-06 |
| Priority | Must |
| Status | approved |
| Milestone | E1 |
| Since | v1.0.0 |

**Critérios de aceite**
- **FR-GOV-01.1** — Dado um cadastro, uma revogação ou um reconhecimento, com ou sem sucesso, quando a
  operação termina, então existe um registro com o ator, o instante e o recurso, sem quadro e sem vetor.
- **FR-GOV-01.2** — Dado um registro de auditoria, quando qualquer papel tenta alterá-lo ou apagá-lo,
  então a operação é negada.
