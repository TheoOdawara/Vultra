# Vultra — Especificação de Requisitos de Software

**Versão:** 1.0.0 · **Data:** 2026-10-06 · [Changelog](CHANGELOG.md)

## Propósito

O Vultra é o sistema de uma Iniciação Científica. Ele registra presença por reconhecimento facial a
partir de uma câmera ESP32-CAM, processa cada quadro apenas em memória e infere a expressão facial no
mesmo quadro. O trabalho acadêmico é o foco: o sistema existe para ser o objeto medido pelo artigo, e o
que não sustenta o artigo nem a demonstração vem depois.

## Escopo

O trabalho é dividido em três estágios, e a coluna Milestone dos requisitos usa o código do estágio no
lugar de `M<N>`, porque M1 a M10 no GitHub pertencem ao plano anterior a este documento.

| Estágio | O que entrega | Prioridade |
| --- | --- | --- |
| **E1 — Núcleo** | A ESP32-CAM envia o quadro, a API o processa em memória, e saem reconhecimento facial e emoção, com as proteções de segurança desde o início. Sem tela. | Must |
| **E2 — Painel** | Login de professor, turma, sessão de chamada, correção manual, relatório de frequência e emoção agregada. | Should |
| **E3 — RH** | Entrega do dado de emoção agregado à equipe de RH. | Could |

**Fora de escopo**

- **Armazenar imagem facial.** O quadro existe apenas em memória; só o vetor derivado é guardado
  ([BR-01](business-rules.md#br-01)).
- **Interface e login de aluno.** O aluno é titular do dado e não opera o sistema.
- **Integração com o sistema cadastral da instituição.** Depende de uma instituição parceira que não
  existe; a criação pela API e a importação em lote cobrem a demonstração.
- **Vários rostos por quadro.** A câmera fica na porta e as pessoas passam uma a uma
  ([BR-02](business-rules.md#br-02)).
- **Emoção de uma pessoa identificável em tela.** Segue em [OQ-04](open-questions.md#oq-04).
- **O sistema de RH.** Pertence a outra equipe; o Vultra entrega dado, não tela de gestão de pessoas.
- **O harness de avaliação do artigo.** Injeta quadros de datasets públicos direto no pipeline e é
  artefato de pesquisa, não superfície do produto. Vive em [`../research/`](../research/).

## Conteúdo

[Visão geral](overview.md) · [Glossário](glossary.md) · [Regras de negócio](business-rules.md) ·
[Questões abertas](open-questions.md)

## Requisitos

Todos foram aprovados por Theo em 2026-10-06, na versão 1.0.0.

### Funcionais

| ID | Nome | Prioridade | Status | Milestone |
| --- | --- | --- | --- | --- |
| [FR-REG-01](functional/registry.md#fr-reg-01) | Criar pessoa | Must | approved | E1 |
| [FR-REG-02](functional/registry.md#fr-reg-02) | Importar pessoas em lote | Should | approved | E2 |
| [FR-DEV-01](functional/devices.md#fr-dev-01) | Registrar câmera | Must | approved | E1 |
| [FR-DEV-02](functional/devices.md#fr-dev-02) | Revogar credencial de câmera | Must | approved | E1 |
| [FR-DEV-03](functional/devices.md#fr-dev-03) | Rotacionar credencial de câmera | Must | approved | E1 |
| [FR-DEV-04](functional/devices.md#fr-dev-04) | Disparar captura sem interface | Must | approved | E1 |
| [FR-BIO-01](functional/biometrics.md#fr-bio-01) | Cadastrar rosto pela câmera | Must | approved | E1 |
| [FR-BIO-02](functional/biometrics.md#fr-bio-02) | Recusar quadro por qualidade | Must | approved | E1 |
| [FR-BIO-03](functional/biometrics.md#fr-bio-03) | Recusar captura sem vivacidade | Must | approved | E1 |
| [FR-BIO-04](functional/biometrics.md#fr-bio-04) | Revogar cadastro biométrico | Must | approved | E1 |
| [FR-REC-01](functional/recognition.md#fr-rec-01) | Registrar evento de reconhecimento | Must | approved | E1 |
| [FR-REC-02](functional/recognition.md#fr-rec-02) | Registrar evento sem identidade | Must | approved | E1 |
| [FR-AFF-01](functional/affective.md#fr-aff-01) | Inferir expressão facial | Must | approved | E1 |
| [FR-AFF-02](functional/affective.md#fr-aff-02) | Gravar emoção da pessoa reconhecida | Must | approved | E1 |
| [FR-AFF-03](functional/affective.md#fr-aff-03) | Agregar emoção por aula e instituição | Should | approved | E2 |
| [FR-AFF-04](functional/affective.md#fr-aff-04) | Suprimir recorte abaixo do grupo mínimo | Should | approved | E2 |
| [FR-AFF-05](functional/affective.md#fr-aff-05) | Entregar emoção agregada ao RH | Could | approved | E3 |
| [FR-ACC-01](functional/access.md#fr-acc-01) | Autenticar gestor | Must | approved | E1 |
| [FR-ACC-02](functional/access.md#fr-acc-02) | Autenticar professor | Should | approved | E2 |
| [FR-ACC-03](functional/access.md#fr-acc-03) | Restringir professor às próprias turmas | Should | approved | E2 |
| [FR-ATT-01](functional/attendance.md#fr-att-01) | Manter turma e matrícula | Should | approved | E2 |
| [FR-ATT-02](functional/attendance.md#fr-att-02) | Abrir sessão de chamada | Should | approved | E2 |
| [FR-ATT-03](functional/attendance.md#fr-att-03) | Encerrar sessão de chamada | Should | approved | E2 |
| [FR-ATT-04](functional/attendance.md#fr-att-04) | Registrar presença única por sessão | Should | approved | E2 |
| [FR-ATT-05](functional/attendance.md#fr-att-05) | Corrigir presença manualmente | Should | approved | E2 |
| [FR-RPT-01](functional/reports.md#fr-rpt-01) | Relatar frequência por turma e período | Should | approved | E2 |
| [FR-GOV-01](functional/governance.md#fr-gov-01) | Auditar operação biométrica | Must | approved | E1 |

### Não funcionais

| ID | Nome | Prioridade | Status | Milestone |
| --- | --- | --- | --- | --- |
| [NFR-SEC-01](non-functional/security.md#nfr-sec-01) | Isolamento por instituição no banco | Must | approved | E1 |
| [NFR-SEC-02](non-functional/security.md#nfr-sec-02) | TLS entre câmera e API | Must | approved | E1 |
| [NFR-SEC-03](non-functional/security.md#nfr-sec-03) | Cota que nega quando indisponível | Must | approved | E1 |
| [NFR-SEC-04](non-functional/security.md#nfr-sec-04) | Autorização que nega por padrão | Must | approved | E1 |
| [NFR-SEC-05](non-functional/security.md#nfr-sec-05) | Segredo fora do repositório e do log | Must | approved | E1 |
| [NFR-SEC-06](non-functional/security.md#nfr-sec-06) | Ambiente obrigatório na inicialização | Must | approved | E1 |
| [NFR-PERF-01](non-functional/performance.md#nfr-perf-01) | Latência da captura ao resultado | Must | approved | E1 |
| [NFR-PERF-02](non-functional/performance.md#nfr-perf-02) | Galeria de 10.000 pessoas | Must | approved | E1 |
| [NFR-REL-01](non-functional/reliability.md#nfr-rel-01) | Inferência indisponível é desfecho tratado | Must | approved | E1 |
| [NFR-FLEX-01](non-functional/flexibility.md#nfr-flex-01) | Mesmos artefatos em dois ambientes | Must | approved | E1 |
| [NFR-INTR-01](non-functional/interaction.md#nfr-intr-01) | Uso em largura de telefone | Should | approved | E2 |
| [NFR-INTR-02](non-functional/interaction.md#nfr-intr-02) | Quatro estados sem deslocamento | Should | approved | E2 |
| [NFR-INTR-03](non-functional/interaction.md#nfr-intr-03) | Operação por teclado | Should | approved | E2 |

### Regras de negócio

| ID | Nome | Status |
| --- | --- | --- |
| [BR-01](business-rules.md#br-01) | Imagem facial nunca é persistida | approved |
| [BR-02](business-rules.md#br-02) | Um rosto por quadro | approved |
| [BR-03](business-rules.md#br-03) | Nada cruza a fronteira da instituição | approved |
| [BR-04](business-rules.md#br-04) | Só dados dos autores, públicos e sintéticos | approved |
| [BR-05](business-rules.md#br-05) | Emoção nunca exposta por pessoa | approved |
| [BR-06](business-rules.md#br-06) | A instituição é a controladora | approved |
