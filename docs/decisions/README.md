# Decisões

Um ADR por decisão que cruza módulos. Um ADR nunca é reescrito: uma decisão nova o substitui.

| ADR | Decisão | Status |
| --- | --- | --- |
| [0001](0001-baseline-de-seguranca.md) | Baseline de segurança | aceito; cita mecanismos do backend anterior |
| [0002](0002-pipeline-de-inferencia-do-ai-service.md) | Modelos do pipeline de inferência | emendado por 0006 |
| [0003](0003-contrato-e-estrutura-da-api.md) | Contrato e estrutura da `api-core` | substituído por 0005 |
| [0004](0004-topologia-e-fundacao-do-portal.md) | Topologia do portal | aceito; reavaliado quando o E2 for planejado |
| [0005](0005-backend-unico-em-python.md) | Backend único em Python com FastAPI | aceito |
| [0006](0006-inferencia-no-processo-do-servico.md) | Inferência no processo do serviço | aceito |
| [0007](0007-canal-da-camera-por-websocket.md) | Canal da câmera por WebSocket sobre TLS | proposto, até o teste de bancada |

Os ADRs anteriores a 2026-10-06 que tratam de um só domínio estão em
[../backend/adrs/](../backend/adrs/README.md) e [../database/adrs/](../database/adrs/README.md).
