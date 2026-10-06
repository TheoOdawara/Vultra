# ATT — Chamada

Turma, sessão de chamada e presença, construídas sobre os eventos de reconhecimento do núcleo.

<a id="fr-att-01"></a>
## FR-ATT-01 — Manter turma e matrícula

> Como gestor, quero turmas com alunos matriculados e professor responsável, para que a falta seja computável.

O sistema deve permitir que um gestor mantenha turmas, cada uma com um professor responsável e os
alunos matriculados.

| Atributo | Valor |
| --- | --- |
| Rationale | Sem saber quem deveria estar na aula não existe falta, só presença |
| Source | Theo, entrevista de 2026-10-06 |
| Priority | Should |
| Status | approved |
| Milestone | E2 |
| Since | v1.0.0 |

**Critérios de aceite**
- **FR-ATT-01.1** — Dado um gestor, quando ele cria uma turma com professor responsável e matricula
  pessoas nela, então a turma aparece para esse professor com os alunos matriculados.

<a id="fr-att-02"></a>
## FR-ATT-02 — Abrir sessão de chamada

> Como professor, quero abrir a chamada de uma turma em uma câmera, para que os reconhecimentos contem como presença.

O sistema deve permitir que o professor responsável abra uma sessão de chamada de uma turma associada a
uma câmera.

| Atributo | Valor |
| --- | --- |
| Rationale | A sessão delimita quais eventos de qual câmera pertencem a qual aula |
| Source | Theo, entrevista de 2026-10-06 |
| Priority | Should |
| Status | approved |
| Milestone | E2 |
| Since | v1.0.0 |

**Critérios de aceite**
- **FR-ATT-02.1** — Dado o professor responsável por uma turma, quando ele abre a sessão em uma câmera
  da instituição, então a sessão fica aberta e ele a reencontra ao recarregar a página.

<a id="fr-att-03"></a>
## FR-ATT-03 — Encerrar sessão de chamada

> Como professor, quero encerrar a chamada, para que a presença daquela aula fique fechada.

O sistema deve permitir que o professor responsável encerre uma sessão de chamada aberta.

| Atributo | Valor |
| --- | --- |
| Rationale | Um evento depois da aula não pode virar presença nela |
| Source | Theo, entrevista de 2026-10-06 |
| Priority | Should |
| Status | approved |
| Milestone | E2 |
| Since | v1.0.0 |

**Critérios de aceite**
- **FR-ATT-03.1** — Dada uma sessão encerrada, quando a câmera reconhece um aluno da turma, então o
  evento é gravado e nenhuma presença é criada naquela sessão.

<a id="fr-att-04"></a>
## FR-ATT-04 — Registrar presença única por sessão

> Como professor, quero a chamada preenchida sozinha, para não perder tempo de aula.

O sistema deve registrar presença, uma única vez por aluno e sessão, quando um evento de reconhecimento
de um aluno matriculado ocorre na câmera de uma sessão aberta.

| Atributo | Valor |
| --- | --- |
| Rationale | É a substituição da chamada manual, razão de existir do produto |
| Source | Theo, entrevista de 2026-10-06 |
| Priority | Should |
| Status | approved |
| Milestone | E2 |
| Since | v1.0.0 |

**Critérios de aceite**
- **FR-ATT-04.1** — Dada uma sessão aberta e um aluno matriculado, quando a câmera o reconhece duas
  vezes, então existe uma única presença dele naquela sessão.

<a id="fr-att-05"></a>
## FR-ATT-05 — Corrigir presença manualmente

> Como professor, quero marcar ou desmarcar presença à mão, para corrigir o que a câmera errou.

O sistema deve permitir que o professor responsável registre ou remova a presença de um aluno em uma
sessão, mantendo o registro manual distinguível do automático.

| Atributo | Valor |
| --- | --- |
| Rationale | O reconhecimento erra, e quem lê o relatório precisa saber o que veio da câmera e o que veio do professor |
| Source | Theo, entrevista de 2026-10-06 |
| Priority | Should |
| Status | approved |
| Milestone | E2 |
| Since | v1.0.0 |

**Critérios de aceite**
- **FR-ATT-05.1** — Dado um aluno não reconhecido em uma sessão, quando o professor marca presença,
  então ela aparece no relatório identificada como manual.
