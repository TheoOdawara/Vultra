# 0007. Canal da câmera por WebSocket sobre TLS

- Status: proposed
- Date: 2026-10-06
- Requisitos: FR-DEV-01, FR-DEV-04, FR-BIO-01, FR-REC-01, NFR-SEC-02, NFR-PERF-01

## Contexto

A captura precisa ser disparada sem interface (FR-DEV-04), o quadro só trafega sobre TLS (NFR-SEC-02), e
o tempo da captura ao resultado é medido pelo artigo (NFR-PERF-01). `esp32-cam/` está vazio:
não há firmware a preservar.

Uma requisição HTTPS avulsa refaz o handshake TLS. Um canal que o repete a cada captura coloca esse
custo, ainda não medido na ESP32-CAM, dentro da latência que o artigo reporta.

## Decisão

**Cada câmera mantém uma conexão WebSocket sobre TLS com o serviço.** A câmera abre a conexão e
autentica com a credencial própria (FR-DEV-01). O serviço empurra o comando de captura com a finalidade,
e a câmera devolve o quadro JPEG como mensagem binária pela mesma conexão.

**O TLS termina no proxy reverso do compose.** Na nuvem o certificado é público; no ambiente local é
emitido por uma CA própria. A câmera valida o servidor com o certificado da CA fixado no firmware.

**Um comando disparado em uma réplica do serviço alcança a câmera conectada em outra** pelo canal de
comandos no Redis ([0006](0006-inferencia-no-processo-do-servico.md)).

**Este ADR só passa a `accepted` depois de um teste de bancada na ESP32-CAM real** que mostre:

1. Conexão `wss://` estabelecida com validação do certificado fixado.
2. Envio de um quadro JPEG como mensagem binária, com a memória livre registrada antes e depois.
3. Reconexão automática após queda da rede.

A biblioteca candidata é o `esp_websocket_client` da Espressif, que documenta `wss://` e certificado em
PEM. Se o teste falhar, vale a alternativa de HTTPS com consulta periódica, e este ADR é reescrito.

## Consequências

- Um handshake TLS por conexão, não por captura.
- O mesmo canal serve à captura contínua durante uma sessão de chamada no E2, sem protocolo novo.
- O serviço passa a manter conexões longas: precisa detectar câmera desconectada e recusar disparo para
  ela com um desfecho tratado.
- Rotacionar ou revogar a credencial (FR-DEV-02, FR-DEV-03) derruba a conexão aberta da câmera.
- O firmware fica mais complexo que um cliente HTTP: mantém conexão, reconecta e trata mensagens.
- A CA local precisa ser gerada e gravada no firmware antes do primeiro teste local.

## Alternativas consideradas

| Alternativa | Por que foi rejeitada |
| --- | --- |
| HTTPS com consulta periódica de comandos | Firmware mais simples, mas o disparo atrasa até o intervalo de consulta e cada captura avulsa paga um handshake. É o plano B se o teste de bancada falhar. |
| MQTT sobre TLS para comandos e HTTPS para o quadro | Acrescenta um broker ao compose e mantém dois canais por câmera. |
| HTTP sem TLS na rede local | Proibido pelo NFR-SEC-02: o quadro e a credencial trafegariam legíveis. |
