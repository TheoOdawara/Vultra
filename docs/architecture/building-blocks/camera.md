# Câmera

`esp32-cam` · AI-Thinker ESP32-CAM, firmware C++ sobre ESP-IDF · estágio E1 · existe só o firmware de bancada da SPEC-005.

## O que faz

Fica na porta da sala. Abre uma conexão WebSocket sobre TLS com o serviço, autentica com a credencial
própria, recebe o comando de captura com a finalidade e devolve o quadro JPEG como mensagem binária pela
mesma conexão ([0007](../../decisions/0007-canal-da-camera-por-websocket.md)).

## O que nunca faz

- Enviar quadro ou credencial sem TLS ([NFR-SEC-02](../../requirements/non-functional/security.md#nfr-sec-02)).
- Guardar o quadro depois de enviá-lo.
- Decidir identidade: toda inferência é do servidor.

## Para mudar com segurança

- O canal está `proposed`. Ele só é aceito depois do teste de bancada na ESP32-CAM real; se o teste
  falhar, o canal passa a HTTPS com consulta periódica e este arquivo é reescrito.
- O teste de bancada usa ESP-IDF e está especificado na
  [SPEC-005](../../specs/teste-de-bancada-do-canal-da-camera.md).
- A câmera valida o servidor com o certificado da CA fixado no firmware; trocar a CA exige regravar o
  aparelho.
