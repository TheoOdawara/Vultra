# Roadmap

Estado ao vivo: o [GitHub Project](https://github.com/users/TheoOdawara/projects/1) e os
[milestones](https://github.com/TheoOdawara/Vultra/milestones). Esta pasta guarda o plano e o histórico
dele, nunca o estado de um item.

Os estágios vêm do [SRS](../requirements/README.md). Só o E1 está dividido em épicos: o E2 é dividido
quando o E1 rodar de ponta a ponta, e o E3 depois de
[OQ-05](../requirements/open-questions.md#oq-05) fechar. Os milestones M6 a M10 do GitHub e as issues
abertas antes de 2026-10-06 pertencem ao plano anterior ao SRS 1.0.0 e foram fechados na issue #180.

## E1 — Núcleo

A ESP32-CAM envia o quadro, a API o processa em memória, e saem reconhecimento facial e emoção, com as
proteções de segurança desde o início. GitHub Milestone:
[E1 — Núcleo](https://github.com/TheoOdawara/Vultra/milestone/10).

Os épicos estão em ordem de construção: o domínio vem primeiro e o acesso depois.

| Épico | Issue | Cobre |
| --- | --- | --- |
| Pipeline de inferência: qualidade, vivacidade, vetor e emoção de um quadro | #174 | FR-BIO-02, FR-BIO-03, FR-AFF-01 |
| Cadastro e reconhecimento: galeria, evento, emoção e auditoria | #175 | FR-BIO-01, FR-BIO-04, FR-REC-01, FR-REC-02, FR-AFF-02, FR-GOV-01, NFR-REL-01, NFR-SEC-01 |
| Acesso do gestor e criação de pessoa | #176 | FR-ACC-01, FR-REG-01, NFR-SEC-04, NFR-SEC-06 |
| Credencial da câmera: registrar, revogar e rotacionar | #177 | FR-DEV-01, FR-DEV-02, FR-DEV-03 |
| Captura disparada pela API, sobre TLS e sob cota | #178 | FR-DEV-04, NFR-SEC-02, NFR-SEC-03 |
| Núcleo medido de ponta a ponta nos dois ambientes | #179 | NFR-PERF-01, NFR-PERF-02, NFR-FLEX-01, NFR-SEC-05 |

Decisões que sustentam essa ordem, tomadas no planejamento de 2026-10-06:

- **Nenhuma rota HTTP nasce antes do épico #176.** Até lá, cadastro e reconhecimento rodam por teste e
  por script que injeta quadros, sem câmera e sem login. É o que deixa o acesso para depois sem servir
  rota sem autenticação ([NFR-SEC-04](../requirements/non-functional/security.md#nfr-sec-04)).
- **O isolamento por instituição nasce com a primeira tabela, no épico #175.**
- **NFR-SEC-05 e NFR-FLEX-01 ficam no épico #179** porque o critério de aceite dos dois pede o fluxo
  completo. O mecanismo de cada um nasce antes, com o código que ele protege.
- **O E1 é planejado sob a hipótese de trabalho de
  [OQ-01](../requirements/open-questions.md#oq-01)**, que continua aberta.
- **O teste de bancada do [ADR 0007](../decisions/0007-canal-da-camera-por-websocket.md) é a issue
  #181** e precisa fechar antes de o épico #178 ser especificado.

## Cobertura de requisitos

Todo requisito aprovado de um estágio planejado pertence a exatamente um épico.

| Requisito | Épico | Estágio |
| --- | --- | --- |
| [FR-REG-01](../requirements/functional/registry.md#fr-reg-01) | #176 | E1 |
| [FR-DEV-01](../requirements/functional/devices.md#fr-dev-01) | #177 | E1 |
| [FR-DEV-02](../requirements/functional/devices.md#fr-dev-02) | #177 | E1 |
| [FR-DEV-03](../requirements/functional/devices.md#fr-dev-03) | #177 | E1 |
| [FR-DEV-04](../requirements/functional/devices.md#fr-dev-04) | #178 | E1 |
| [FR-BIO-01](../requirements/functional/biometrics.md#fr-bio-01) | #175 | E1 |
| [FR-BIO-02](../requirements/functional/biometrics.md#fr-bio-02) | #174 | E1 |
| [FR-BIO-03](../requirements/functional/biometrics.md#fr-bio-03) | #174 | E1 |
| [FR-BIO-04](../requirements/functional/biometrics.md#fr-bio-04) | #175 | E1 |
| [FR-REC-01](../requirements/functional/recognition.md#fr-rec-01) | #175 | E1 |
| [FR-REC-02](../requirements/functional/recognition.md#fr-rec-02) | #175 | E1 |
| [FR-AFF-01](../requirements/functional/affective.md#fr-aff-01) | #174 | E1 |
| [FR-AFF-02](../requirements/functional/affective.md#fr-aff-02) | #175 | E1 |
| [FR-ACC-01](../requirements/functional/access.md#fr-acc-01) | #176 | E1 |
| [FR-GOV-01](../requirements/functional/governance.md#fr-gov-01) | #175 | E1 |
| [NFR-SEC-01](../requirements/non-functional/security.md#nfr-sec-01) | #175 | E1 |
| [NFR-SEC-02](../requirements/non-functional/security.md#nfr-sec-02) | #178 | E1 |
| [NFR-SEC-03](../requirements/non-functional/security.md#nfr-sec-03) | #178 | E1 |
| [NFR-SEC-04](../requirements/non-functional/security.md#nfr-sec-04) | #176 | E1 |
| [NFR-SEC-05](../requirements/non-functional/security.md#nfr-sec-05) | #179 | E1 |
| [NFR-SEC-06](../requirements/non-functional/security.md#nfr-sec-06) | #176 | E1 |
| [NFR-PERF-01](../requirements/non-functional/performance.md#nfr-perf-01) | #179 | E1 |
| [NFR-PERF-02](../requirements/non-functional/performance.md#nfr-perf-02) | #179 | E1 |
| [NFR-REL-01](../requirements/non-functional/reliability.md#nfr-rel-01) | #175 | E1 |
| [NFR-FLEX-01](../requirements/non-functional/flexibility.md#nfr-flex-01) | #179 | E1 |

## Sprints

- [Sprint 1](sprints/sprint-01.md) — dado um quadro, o pipeline devolve a recusa ou o vetor e a emoção
