# REG — Registro de pessoas

Como as pessoas de uma instituição passam a existir no sistema para poderem ter o rosto cadastrado.

<a id="fr-reg-01"></a>
## FR-REG-01 — Criar pessoa

> Como gestor, quero criar o registro de uma pessoa, para que o rosto dela possa ser cadastrado.

O sistema deve permitir que um gestor crie, pela API, o registro de uma pessoa da própria instituição
com identificador externo e nome.

| Atributo | Valor |
| --- | --- |
| Rationale | O cadastro biométrico precisa de alguém a quem se vincular, e o núcleo não tem tela |
| Source | Theo, entrevista de 2026-10-06 |
| Priority | Must |
| Status | approved |
| Milestone | E1 |
| Since | v1.0.0 |

**Critérios de aceite**
- **FR-REG-01.1** — Dado um gestor autenticado, quando ele cria uma pessoa com identificador externo e
  nome, então a pessoa passa a existir na instituição dele e pode receber cadastro biométrico.
- **FR-REG-01.2** — Dado um identificador externo já usado na instituição, quando o gestor cria outra
  pessoa com ele, então a criação é recusada com o motivo.

<a id="fr-reg-02"></a>
## FR-REG-02 — Importar pessoas em lote

> Como gestor, quero importar uma lista de pessoas, para não criar cada uma à mão.

O sistema deve permitir que um gestor importe um arquivo com várias pessoas e devolver o resultado de
cada linha.

| Atributo | Valor |
| --- | --- |
| Rationale | Em uso real a lista vem do sistema da instituição, e criar pessoa a pessoa não escala |
| Source | Theo, entrevista de 2026-10-06 |
| Priority | Should |
| Status | approved |
| Milestone | E2 |
| Since | v1.0.0 |

**Critérios de aceite**
- **FR-REG-02.1** — Dado um arquivo com linhas válidas e inválidas, quando o gestor o importa, então as
  válidas viram pessoas e cada inválida volta identificada com o motivo da recusa.
