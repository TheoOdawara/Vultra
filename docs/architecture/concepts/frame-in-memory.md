# O quadro só em memória

Regra: [BR-01](../../requirements/business-rules.md#br-01). O quadro é a imagem de uma captura, e o
único dado biométrico guardado é o vetor derivado dele.

## Por onde o quadro passa

| Bloco | O quadro existe como | Até quando |
| --- | --- | --- |
| Câmera | Buffer da captura | O envio |
| Proxy TLS | Bytes em trânsito | O encaminhamento |
| Serviço | Bytes da mensagem recebida | A entrega ao pool |
| Pipeline | Bytes e matriz de imagem no processo do pool | O fim da inferência |

## Por onde ele nunca passa

PostgreSQL, Redis, disco, log, trilha de auditoria, mensagem de erro e resposta de API.

## O que isso exige de cada bloco

- O proxy não registra corpo de requisição.
- O serviço não inclui o quadro, nem um recorte dele, em log ou em exceção.
- O pipeline não grava arquivo temporário.
- A inferência não passa por fila em Redis enquanto ele tiver persistência ligada
  ([0006](../../decisions/0006-inferencia-no-processo-do-servico.md)).
