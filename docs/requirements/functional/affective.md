# AFF — Emoção

A inferência de expressão facial, onde ela fica guardada e como é exposta.

<a id="fr-aff-01"></a>
## FR-AFF-01 — Inferir expressão facial

> Como pesquisador, quero a expressão facial de cada captura reconhecida, para medi-la no artigo.

O sistema deve inferir, no mesmo quadro de uma captura de reconhecimento, a expressão facial e
classificá-la em um conjunto fechado de rótulos, com a confiança da inferência.

| Atributo | Valor |
| --- | --- |
| Rationale | A emoção é parte do núcleo que o artigo avalia, e usar o mesmo quadro evita uma segunda captura |
| Source | Theo, entrevista de 2026-10-06 |
| Priority | Must |
| Status | approved |
| Milestone | E1 |
| Since | v1.0.0 |

**Critérios de aceite**
- **FR-AFF-01.1** — Dada uma captura de reconhecimento aceita, quando o quadro é processado, então o
  resultado traz um rótulo do conjunto fechado e a confiança, ou a indicação de que não houve
  inferência.
- **FR-AFF-01.2** — Dada uma falha na inferência de expressão, quando o quadro é processado, então o
  evento de reconhecimento é gravado mesmo assim, sem emoção.

<a id="fr-aff-02"></a>
## FR-AFF-02 — Gravar emoção da pessoa reconhecida

> Como pesquisador, quero a emoção guardada com o evento, para analisá-la depois.

O sistema deve gravar a emoção inferida e sua confiança no evento de reconhecimento da pessoa
reconhecida.

| Atributo | Valor |
| --- | --- |
| Rationale | Guardar por pessoa mantém aberta qualquer análise futura sem refazer a coleta |
| Source | Theo, entrevista de 2026-10-06 |
| Priority | Must |
| Status | approved |
| Milestone | E1 |
| Since | v1.0.0 |

**Critérios de aceite**
- **FR-AFF-02.1** — Dado um evento de reconhecimento com pessoa e emoção inferida, quando ele é
  gravado, então o rótulo e a confiança ficam no mesmo evento.

<a id="fr-aff-03"></a>
## FR-AFF-03 — Agregar emoção por aula e instituição

> Como gestor, quero ver a emoção de uma aula e da instituição, para identificar o que melhorar.

O sistema deve expor ao gestor a distribuição de emoção agregada por sessão de chamada e pelo conjunto
da instituição em um período.

| Atributo | Valor |
| --- | --- |
| Rationale | A tendência de um grupo é uma leitura defensável; a de um indivíduo não é ([BR-05](../business-rules.md#br-05)) |
| Source | Theo, entrevista de 2026-10-06 |
| Priority | Should |
| Status | approved |
| Milestone | E2 |
| Since | v1.0.0 |

**Critérios de aceite**
- **FR-AFF-03.1** — Dado um gestor e um período, quando ele consulta a emoção agregada, então recebe a
  distribuição por rótulo de cada sessão de chamada e a da instituição, sem identificar pessoa alguma.

<a id="fr-aff-04"></a>
## FR-AFF-04 — Suprimir recorte abaixo do grupo mínimo

> Como aluno, quero que um grupo pequeno não revele o meu estado, para não ser identificado por exclusão.

O sistema deve mostrar como suprimido todo recorte de emoção agregada com menos de 10 pessoas distintas.

| Atributo | Valor |
| --- | --- |
| Rationale | Em grupo pequeno o agregado deixa de proteger o indivíduo; o recorte aparece suprimido, e não omitido, para que o tamanho do grupo não seja inferido por diferença |
| Source | Theo, entrevista de 2026-10-06 |
| Priority | Should |
| Status | approved |
| Milestone | E2 |
| Since | v1.0.0 |

**Critérios de aceite**
- **FR-AFF-04.1** — Dada uma sessão de chamada com 9 pessoas distintas reconhecidas, quando o gestor
  consulta a emoção dela, então o recorte aparece marcado como suprimido e sem valores.
- **FR-AFF-04.2** — Dada uma sessão com 10 pessoas distintas reconhecidas, quando o gestor consulta a
  emoção dela, então a distribuição é exibida.

<a id="fr-aff-05"></a>
## FR-AFF-05 — Entregar emoção agregada ao RH

> Como equipe de RH, quero o dado de emoção agregado, para orientar ações de bem-estar.

O sistema deve disponibilizar à equipe de RH a emoção agregada, sob as mesmas regras de supressão do
[FR-AFF-04](#fr-aff-04).

| Atributo | Valor |
| --- | --- |
| Rationale | É um ganho adicional do dado que o núcleo já produz; não é obrigação desta entrega |
| Source | Theo, entrevista de 2026-10-06 |
| Priority | Could |
| Status | approved |
| Milestone | E3 |
| Since | v1.0.0 |

**Critérios de aceite**
- **FR-AFF-05.1** — Dada a forma de entrega decidida em [OQ-05](../open-questions.md#oq-05), quando a
  equipe de RH obtém o dado, então nenhum recorte recebido corresponde a menos de 10 pessoas distintas.
