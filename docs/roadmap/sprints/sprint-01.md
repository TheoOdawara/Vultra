# Sprint 1 — 2026-10-05 → 2026-10-11

**Meta:** a ESP32-CAM real conecta por `wss://` com o certificado fixado, entrega um quadro JPEG e
reconecta depois de uma queda de rede.
**Baseline de requisitos:** v1.0.0 no início; v1.1.0 desde 2026-10-07, mudança decidida na #186.
**Itens:** #173, #180, #184, #181, #183, #176, #186

Em ordem de dependência:

1. #181 — o teste de bancada que decide o [ADR 0007](../../decisions/0007-canal-da-camera-por-websocket.md).
2. #183 — o levantamento de modelos de vivacidade, que não depende de hardware.
3. #176 — a spec, as sub-issues que ela gera e a primeira delas, #186. As sub-issues #187 a #189 abrem o
   Sprint 2.

## Replanejamento de 2026-10-06

O sprint começou com a meta "dado um quadro, o pipeline devolve a recusa por qualidade ou vivacidade, ou
o vetor e a emoção", e com o épico #174 como item. A issue #184 trocou a ordem do E1: o quadro que
alimenta o pipeline chega pela ESP32-CAM desde o início, então a captura vem antes do pipeline. O épico
#174 voltou ao Backlog sem spec escrita.

## Resultado — fechado em 2026-10-09

O sprint fechou dois dias antes do fim. Os sete itens estão concluídos.

| Item | Concluído em | Entrou por |
| --- | --- | --- |
| #173 | 2026-10-07 | PR #182 |
| #180 | 2026-10-07 | fechamento das issues e dos milestones do plano anterior |
| #184 | 2026-10-07 | PR #185 |
| #176 e #186 | 2026-10-08 | PRs #190 e #192 |
| #181 | 2026-10-09 | PR #194 |
| #183 | 2026-10-09 | PR #195 |

As sub-issues #187, #188 e #189, previstas para abrir o Sprint 2, também entraram pelo PR #192. O épico
#176 saiu inteiro.

**A meta foi cumprida em parte.** A ESP32-CAM conecta por `wss://` com o certificado fixado e entrega o
quadro JPEG, medido na #181. A reconexão depois de uma queda de rede foi observada, mas o tempo não foi
medido: o ponto de acesso não pôde ser desligado no dia do teste. A medição é a #193 e segue para o
[Sprint 2](sprint-02.md).

O que o sprint mudou fora do código:

- O [ADR 0007](../../decisions/0007-canal-da-camera-por-websocket.md) passou a `accepted`, com o critério
  de reconexão pendente.
- O [ADR 0006](../../decisions/0006-inferencia-no-processo-do-servico.md) foi emendado: a vivacidade usa
  o par MiniFASNetV2 e MiniFASNetV1SE.
- O teste de bancada mostrou que o rádio da placa não sustenta o canal com sinal pior que cerca de
  -60 dBm quando a câmera está ligada. O risco está em [Riscos e dívida](../../architecture/risks.md).
