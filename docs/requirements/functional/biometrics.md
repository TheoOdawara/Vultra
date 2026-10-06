# BIO — Cadastro biométrico

Como um rosto entra na galeria, o que impede um quadro ruim ou falso de entrar, e como ele sai.

<a id="fr-bio-01"></a>
## FR-BIO-01 — Cadastrar rosto pela câmera

> Como gestor, quero cadastrar o rosto de uma pessoa pela câmera, para que ela passe a ser reconhecida.

O sistema deve criar o cadastro biométrico de uma pessoa a partir de um quadro capturado pela
ESP32-CAM com finalidade de cadastro.

| Atributo | Valor |
| --- | --- |
| Rationale | Um único caminho de captura, o mesmo que o artigo avalia |
| Source | Theo, entrevista de 2026-10-06 |
| Priority | Must |
| Status | approved |
| Milestone | E1 |
| Since | v1.0.0 |

**Critérios de aceite**
- **FR-BIO-01.1** — Dada uma pessoa sem cadastro biométrico e uma captura de cadastro aceita, quando o
  quadro é processado, então a pessoa ganha um cadastro ativo e é reconhecida na captura seguinte.

<a id="fr-bio-02"></a>
## FR-BIO-02 — Recusar quadro por qualidade

> Como gestor, quero saber por que um quadro foi recusado, para repetir a captura do jeito certo.

O sistema deve recusar um quadro cuja qualidade esteja abaixo do limiar e informar o motivo da recusa.

| Atributo | Valor |
| --- | --- |
| Rationale | Um vetor de quadro ruim degrada todo reconhecimento posterior daquela pessoa |
| Source | Theo, entrevista de 2026-10-06 |
| Priority | Must |
| Status | approved |
| Milestone | E1 |
| Since | v1.0.0 |

**Critérios de aceite**
- **FR-BIO-02.1** — Dado um quadro abaixo do limiar de qualidade, quando ele é processado, então a
  captura é recusada com o motivo e nenhum cadastro nem evento com pessoa é criado.

<a id="fr-bio-03"></a>
## FR-BIO-03 — Recusar captura sem vivacidade

> Como instituição, quero que foto e tela não passem por pessoa, para que a presença não seja fraudada.

O sistema deve recusar, no cadastro e no reconhecimento, um quadro que não corresponda a uma pessoa
fisicamente presente.

| Atributo | Valor |
| --- | --- |
| Rationale | A chamada manual era falsificável; aceitar a foto de um colega reintroduz a mesma fraude |
| Source | Theo, entrevista de 2026-10-06 |
| Priority | Must |
| Status | approved |
| Milestone | E1 |
| Since | v1.0.0 |

**Critérios de aceite**
- **FR-BIO-03.1** — Dada uma foto impressa ou uma tela mostrando um rosto cadastrado, quando a câmera a
  captura, então a captura é recusada e nenhum cadastro nem evento com pessoa é criado.

<a id="fr-bio-04"></a>
## FR-BIO-04 — Revogar cadastro biométrico

> Como gestor, quero revogar o cadastro de uma pessoa, para que ela deixe de ser reconhecida.

O sistema deve permitir que um gestor revogue o cadastro biométrico de uma pessoa, inutilizando o vetor.

| Atributo | Valor |
| --- | --- |
| Rationale | O titular tem direito à eliminação, e um vetor apenas marcado continua sendo dado biométrico |
| Source | Theo, entrevista de 2026-10-06 |
| Priority | Must |
| Status | approved |
| Milestone | E1 |
| Since | v1.0.0 |

**Critérios de aceite**
- **FR-BIO-04.1** — Dada uma pessoa com cadastro revogado, quando a câmera a captura, então o resultado
  é um evento sem identidade.
- **FR-BIO-04.2** — Dado um cadastro revogado, quando se inspeciona o banco, então o vetor não é
  recuperável.
