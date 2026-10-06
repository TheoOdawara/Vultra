# Regras de negócio

Políticas que valem em qualquer funcionalidade.

<a id="br-01"></a>
## BR-01 — Imagem facial nunca é persistida

O quadro existe apenas em memória durante o processamento. Não entra em banco, disco, log, trilha de
auditoria, mensagem de erro nem resposta.

| Atributo | Valor |
| --- | --- |
| Rationale | Guardar só o vetor é o que torna o tratamento mínimo e é uma das propriedades que o artigo avalia |
| Source | Theo, entrevista de 2026-10-06 |
| Status | approved |
| Since | v1.0.0 |

**Critérios de aceite**
- **BR-01.1** — Dada uma captura processada, com ou sem sucesso, quando se inspeciona banco, disco e
  log, então nenhum deles contém o quadro nem um recorte dele.

<a id="br-02"></a>
## BR-02 — Um rosto por quadro

Um quadro com mais de um rosto é recusado e não gera cadastro nem reconhecimento.

| Atributo | Valor |
| --- | --- |
| Rationale | A câmera fica na porta e as pessoas passam uma a uma; mais de um rosto é ambíguo quanto a quem está presente |
| Source | Theo, entrevista de 2026-10-06 |
| Status | approved |
| Since | v1.0.0 |

**Critérios de aceite**
- **BR-02.1** — Dado um quadro com dois rostos, quando ele é processado, então a captura é recusada com
  o motivo e nenhum evento de reconhecimento com pessoa é gravado.

<a id="br-03"></a>
## BR-03 — Nada cruza a fronteira da instituição

Nenhuma leitura ou escrita alcança dado de outra instituição, sob nenhum papel e por nenhuma câmera.

| Atributo | Valor |
| --- | --- |
| Rationale | O sistema é multitenant desde o núcleo, e o isolamento é o objeto da seção experimental do artigo |
| Source | Theo, entrevista de 2026-10-06 |
| Status | approved |
| Since | v1.0.0 |

**Critérios de aceite**
- **BR-03.1** — Dado um gestor da instituição A, quando ele requisita um recurso da instituição B pelo
  identificador correto, então a resposta é a mesma de um recurso inexistente.
- **BR-03.2** — Dada uma captura de uma câmera da instituição A, quando ela é reconhecida, então só a
  galeria da instituição A é comparada.

<a id="br-04"></a>
## BR-04 — Só dados dos autores, públicos e sintéticos

Enquanto [OQ-02](open-questions.md#oq-02) e [OQ-04](open-questions.md#oq-04) estiverem abertas, as
únicas pessoas reais cujo rosto entra no sistema são Theo Odawara e Vinicius Larsen. Todo o resto vem
de datasets públicos ou é sintético.

| Atributo | Valor |
| --- | --- |
| Rationale | Não há decisão ética nem base legal para tratar dado de terceiros |
| Source | Theo, entrevista de 2026-10-06 |
| Status | approved |
| Since | v1.0.0 |

**Critérios de aceite**
- **BR-04.1** — Dado qualquer ambiente do sistema, quando se lista a origem dos cadastros biométricos,
  então cada um vem de um dos dois autores, de um dataset público identificado ou de geração sintética.

<a id="br-05"></a>
## BR-05 — Emoção nunca exposta por pessoa

O sistema grava a emoção ligada à pessoa reconhecida, mas nenhuma resposta, tela ou entrega mostra a
emoção de uma pessoa identificável. A exposição é sempre agregada.

| Atributo | Valor |
| --- | --- |
| Rationale | A expressão de um quadro é sinal fraco sobre um indivíduo, e não há base legal decidida para a visão individual ([OQ-04](open-questions.md#oq-04)) |
| Source | Theo, entrevista de 2026-10-06 |
| Status | approved |
| Since | v1.0.0 |

**Critérios de aceite**
- **BR-05.1** — Dado qualquer papel autenticado, quando ele consulta dado de emoção, então nenhum
  recorte devolvido corresponde a uma única pessoa.

<a id="br-06"></a>
## BR-06 — A instituição é a controladora

Os dados cadastrais pertencem à instituição. O Vultra guarda de cada pessoa apenas o identificador
externo e o nome, além do vetor e dos eventos que ele próprio produz.

| Atributo | Valor |
| --- | --- |
| Rationale | Em uso real o cadastro vem de fora do sistema; espelhar o mínimo reduz o dado pessoal sob guarda |
| Source | Theo, entrevista de 2026-10-06 |
| Status | approved |
| Since | v1.0.0 |

**Critérios de aceite**
- **BR-06.1** — Dado o registro de uma pessoa, quando se listam os campos guardados, então há apenas
  identificador externo e nome como dado cadastral.
