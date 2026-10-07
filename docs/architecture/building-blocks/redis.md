# Redis

Imagem `redis:7-alpine` · já está no compose, servindo o backend anterior.

## O que faz

- Guarda o estado da cota por câmera e por instituição
  ([NFR-SEC-03](../../requirements/non-functional/security.md#nfr-sec-03)).
- Guarda o estado da cota do login, por IP e por e-mail
  ([SPEC-004](../../specs/acesso-do-gestor-e-criacao-de-pessoa.md)). É o primeiro uso, no épico #176.
- Leva o comando de captura até a réplica do serviço em que a câmera está conectada
  ([0007](../../decisions/0007-canal-da-camera-por-websocket.md)).

## O que nunca faz

- Carregar quadro. No backend anterior o quadro passava pela fila em base64, com volume em `/data` e
  snapshot ligado; no decidido, o quadro não passa por aqui
  ([0006](../../decisions/0006-inferencia-no-processo-do-servico.md)).

## Para mudar com segurança

- Redis indisponível nega a requisição com cota; nunca libera.
- Se a medição de [OQ-03](../../requirements/open-questions.md#oq-03) levar a inferência de volta para
  uma fila aqui, a persistência precisa ser desligada antes.
