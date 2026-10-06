# DEV — Câmeras

O ciclo de vida de uma ESP32-CAM na instituição e como uma captura é disparada.

<a id="fr-dev-01"></a>
## FR-DEV-01 — Registrar câmera

> Como gestor, quero registrar uma câmera, para que ela possa enviar capturas da minha instituição.

O sistema deve permitir que um gestor registre uma câmera na própria instituição e emitir para ela uma
credencial própria, distinta de qualquer credencial de usuário.

| Atributo | Valor |
| --- | --- |
| Rationale | Cada câmera precisa ser identificável e revogável sozinha |
| Source | Theo, entrevista de 2026-10-06 |
| Priority | Must |
| Status | approved |
| Milestone | E1 |
| Since | v1.0.0 |

**Critérios de aceite**
- **FR-DEV-01.1** — Dado um gestor autenticado, quando ele registra uma câmera, então recebe a
  credencial dela uma única vez, e a câmera passa a autenticar com essa credencial.
- **FR-DEV-01.2** — Dada uma captura sem credencial ou com credencial desconhecida, quando ela chega,
  então é recusada sem ser processada.

<a id="fr-dev-02"></a>
## FR-DEV-02 — Revogar credencial de câmera

> Como gestor, quero revogar a credencial de uma câmera, para que um aparelho perdido pare de enviar.

O sistema deve permitir que um gestor revogue a credencial de uma câmera da própria instituição.

| Atributo | Valor |
| --- | --- |
| Rationale | Uma câmera extraviada ou comprometida não pode continuar autenticando |
| Source | Theo, entrevista de 2026-10-06 |
| Priority | Must |
| Status | approved |
| Milestone | E1 |
| Since | v1.0.0 |

**Critérios de aceite**
- **FR-DEV-02.1** — Dada uma câmera com credencial revogada, quando ela envia uma captura, então a
  captura é recusada.

<a id="fr-dev-03"></a>
## FR-DEV-03 — Rotacionar credencial de câmera

> Como gestor, quero trocar a credencial de uma câmera, para renová-la sem registrar a câmera de novo.

O sistema deve permitir que um gestor substitua a credencial de uma câmera por uma nova, mantendo o
registro da câmera.

| Atributo | Valor |
| --- | --- |
| Rationale | Credencial de longa duração precisa ser renovável sem perder o histórico da câmera |
| Source | Theo, entrevista de 2026-10-06 |
| Priority | Must |
| Status | approved |
| Milestone | E1 |
| Since | v1.0.0 |

**Critérios de aceite**
- **FR-DEV-03.1** — Dada uma câmera com a credencial rotacionada, quando ela envia capturas, então a
  credencial nova é aceita, a antiga é recusada, e os eventos anteriores continuam ligados à mesma
  câmera.

<a id="fr-dev-04"></a>
## FR-DEV-04 — Disparar captura sem interface

> Como gestor, quero mandar uma câmera capturar, para cadastrar e reconhecer sem depender de tela.

O sistema deve permitir que um gestor dispare, pela API, uma captura em uma câmera da própria
instituição, informando se a finalidade é cadastro ou reconhecimento.

| Atributo | Valor |
| --- | --- |
| Rationale | O núcleo é construído e medido antes de existir painel |
| Source | Theo, entrevista de 2026-10-06 |
| Priority | Must |
| Status | approved |
| Milestone | E1 |
| Since | v1.0.0 |

**Critérios de aceite**
- **FR-DEV-04.1** — Dado um disparo de captura para uma câmera registrada e ligada, quando a câmera o
  recebe, então ela captura um quadro e o envia com a finalidade pedida.
- **FR-DEV-04.2** — Dado um disparo para uma câmera de outra instituição, quando o gestor o pede, então
  a resposta é a mesma de uma câmera inexistente.
