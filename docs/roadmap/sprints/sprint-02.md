# Sprint 2 — 2026-10-09 → 2026-10-15

**Meta:** um quadro real da ESP32-CAM cadastra o rosto de uma pessoa, e um quadro seguinte a reconhece,
com a emoção.
**Baseline de requisitos:** v1.1.0. Nenhuma `requirement-change` aberta.
**Itens:** #174, #175, #193

Em ordem de dependência:

1. #174 — o pipeline: dado um quadro, a recusa por qualidade ou vivacidade, ou o vetor e a emoção. A spec
   vem antes do código.
2. #175 — cadastro e reconhecimento sobre o pipeline: a galeria, o evento, a emoção e a auditoria. A spec
   vem antes do código e depende do #174.
3. #193 — a medição do tempo de reconexão da câmera, que ficou do Sprint 1. Não depende dos outros dois.

## Replanejamento de 2026-10-09

Theo decidiu que o reconhecimento funciona primeiro. A issue #196 trocou a ordem do E1: os épicos #177,
credencial da câmera, e #178, captura disparada pela API, saem da frente do pipeline e vêm depois do #175.
O quadro continua vindo da ESP32-CAM real, pelo canal de bancada da #181.
