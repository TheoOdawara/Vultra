# Sprint 1 — 2026-10-05 → 2026-10-11

**Meta:** a ESP32-CAM real conecta por `wss://` com o certificado fixado, entrega um quadro JPEG e
reconecta depois de uma queda de rede.
**Baseline de requisitos:** v1.0.0, sem pedido de mudança aberto.
**Itens:** #173, #180, #184, #181, #183, #176

Em ordem de dependência:

1. #181 — o teste de bancada que decide o [ADR 0007](../../decisions/0007-canal-da-camera-por-websocket.md).
2. #183 — o levantamento de modelos de vivacidade, que não depende de hardware.
3. #176 — só a spec e as sub-issues que ela gera. O código do épico abre o Sprint 2.

## Replanejamento de 2026-10-06

O sprint começou com a meta "dado um quadro, o pipeline devolve a recusa por qualidade ou vivacidade, ou
o vetor e a emoção", e com o épico #174 como item. A issue #184 trocou a ordem do E1: o quadro que
alimenta o pipeline chega pela ESP32-CAM desde o início, então a captura vem antes do pipeline. O épico
#174 voltou ao Backlog sem spec escrita.
