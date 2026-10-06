# ACC — Acesso

Quem autentica no sistema e o que cada papel alcança. O aluno não autentica.

<a id="fr-acc-01"></a>
## FR-ACC-01 — Autenticar gestor

> Como gestor, quero me autenticar na API, para operar o núcleo da minha instituição sem tela.

O sistema deve autenticar um gestor e restringir as operações dele à própria instituição.

| Atributo | Valor |
| --- | --- |
| Rationale | Criar pessoa, registrar câmera, disparar captura e revogar precisam de um chamador autenticado já no núcleo |
| Source | Theo, entrevista de 2026-10-06 |
| Priority | Must |
| Status | approved |
| Milestone | E1 |
| Since | v1.0.0 |

**Critérios de aceite**
- **FR-ACC-01.1** — Dado um gestor com credencial válida, quando ele se autentica, então consegue
  operar pessoas, câmeras e cadastros biométricos da própria instituição.
- **FR-ACC-01.2** — Dada uma credencial inválida, quando a autenticação é tentada, então é recusada sem
  revelar se o usuário existe.

<a id="fr-acc-02"></a>
## FR-ACC-02 — Autenticar professor

> Como professor, quero entrar no painel, para fazer a chamada das minhas turmas.

O sistema deve autenticar um professor no painel.

| Atributo | Valor |
| --- | --- |
| Rationale | A chamada é operada pelo docente, não pela secretaria |
| Source | Theo, entrevista de 2026-10-06 |
| Priority | Should |
| Status | approved |
| Milestone | E2 |
| Since | v1.0.0 |

**Critérios de aceite**
- **FR-ACC-02.1** — Dado um professor com credencial válida, quando ele entra no painel, então chega à
  área de chamada das próprias turmas.

<a id="fr-acc-03"></a>
## FR-ACC-03 — Restringir professor às próprias turmas

> Como instituição, quero que cada professor alcance só as turmas dele, para que um não opere a chamada de outro.

O sistema deve negar a um professor a leitura e a operação de turmas e sessões de chamada das quais ele
não é o responsável.

| Atributo | Valor |
| --- | --- |
| Rationale | Escopo por professor é regra de servidor; uma tela que esconde um controle não é controle de acesso |
| Source | Theo, entrevista de 2026-10-06 |
| Priority | Should |
| Status | approved |
| Milestone | E2 |
| Since | v1.0.0 |

**Critérios de aceite**
- **FR-ACC-03.1** — Dado um professor com o identificador correto de uma turma alheia, quando ele a
  requisita, então a resposta é a mesma de uma turma inexistente.
