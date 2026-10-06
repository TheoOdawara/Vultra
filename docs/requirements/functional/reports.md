# RPT — Relatórios

A leitura consolidada da presença.

<a id="fr-rpt-01"></a>
## FR-RPT-01 — Relatar frequência por turma e período

> Como professor, quero a frequência da minha turma em um período, para acompanhar quem falta.

O sistema deve apresentar a frequência por turma e período, com presenças e faltas de cada aluno
matriculado, restrita às turmas que quem consulta alcança.

| Atributo | Valor |
| --- | --- |
| Rationale | É o dado aproveitável que a chamada em papel não gera |
| Source | Theo, entrevista de 2026-10-06 |
| Priority | Should |
| Status | approved |
| Milestone | E2 |
| Since | v1.0.0 |

**Critérios de aceite**
- **FR-RPT-01.1** — Dado um professor e um período, quando ele consulta a frequência de uma turma
  própria, então vê, por aluno matriculado, as presenças e as faltas nas sessões do período.
- **FR-RPT-01.2** — Dado um gestor, quando ele consulta a frequência, então alcança todas as turmas da
  instituição.
