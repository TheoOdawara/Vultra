# SPEC-007 — Processar um quadro: qualidade, vivacidade, vetor e emoção

> **Status:** publicada
> **Perfil:** API
> **Módulo:** `packages/pipeline`; `apps/api`, módulo `devices` e `app/core`; `esp32-cam`; `infra`
> **Epic:** #174
> **Requisitos:** FR-BIO-02, FR-BIO-03, FR-AFF-01, BR-01, BR-02
> **Sprint:** 2

O épico cria `packages/pipeline`, que recebe um quadro e a finalidade e devolve a recusa com o motivo, ou
o vetor e a emoção. Para o quadro vir da ESP32-CAM real desde o início, ele também cria a entrada
WebSocket de bancada em `apps/api`, o pool de processos e o Proxy TLS. O resultado de cada quadro vira
uma linha de log; as tabelas, a galeria e o evento são do épico #175.

Substitui a [SPEC-001](ai-service-pipeline-inferencia.md), que descreve o `ai-service` do plano anterior.

## Premissas confirmadas

Confirmadas por Theo em 2026-10-09.

1. A superfície do pacote é uma função, `process_frame(frame, purpose)`. `frame` é o JPEG que a câmera
   envia; `purpose` é `enrollment` ou `recognition`.
2. Os modelos carregam na primeira chamada de cada processo e ficam em memória. O pacote não acessa
   banco nem rede, e não grava nada em disco.
3. A primeira recusa encerra o processamento. O motivo é específico; não há nota composta de qualidade
   nem regra de centralização do rosto.
4. Cadastro e reconhecimento usam os mesmos limiares. A única diferença é a emoção, inferida só em
   `recognition`.
5. A vivacidade segue a regra do repositório oficial: as saídas dos dois modelos são somadas e o quadro
   passa quando a classe vencedora é a de rosto real. Não há limiar extra.
6. A emoção nunca recusa o quadro.
7. Os limiares são constantes do pacote, sem variável de ambiente. O resultado leva as medidas de cada
   etapa, para o harness do artigo avaliar outros limiares sem reprocessar.
8. Os testes cobrem as regras de decisão com a saída dos modelos simulada. Nenhum peso e nenhuma imagem
   de rosto entram no git; os modelos reais são conferidos na bancada, com a ESP32-CAM.
9. A entrada do quadro no serviço nasce neste épico: uma rota WebSocket em `apps/api`, atrás do Proxy
   TLS, que entrega o quadro ao pool de processos.
10. Até o épico #177, a câmera de bancada autentica com um token único, lido de variável de ambiente. O
    #177 o substitui pela credencial por câmera do
    [FR-DEV-01](../requirements/functional/devices.md#fr-dev-01).
11. O Proxy TLS entra agora em `infra/compose.yaml`, com Caddy e certificado de uma CA própria.
12. O serviço grava uma linha de log por quadro e não responde nada à câmera. A finalidade vem da URI da
    conexão, porque o comando de captura é do épico #178.
13. Os dois ONNX do MiniFASNet são publicados como assets de uma Release deste repositório. O diretório
    dos modelos vem da variável `PIPELINE_MODEL_DIR`.

## Valores confirmados

Confirmados por Theo em 2026-10-09. Os limiares de qualidade, de frontalidade e de emoção são os valores
iniciais da SPEC-001.

| Valor | Decisão |
| --- | --- |
| Menor lado da caixa do rosto | ≥ 50 px |
| Assimetria olho–nariz (`yaw_ratio`) | ≤ 0,35 |
| Inclinação da linha dos olhos (`roll_degrees`) | ≤ 25,0° |
| Brilho médio do rosto, em cinza de 0 a 255 | 40,0 a 220,0 |
| Nitidez: variância do Laplaciano do rosto em cinza | > 100,0 |
| Confiança mínima da emoção | 0,40 |
| Detecção | entrada de 640×640 e pontuação mínima de 0,5 |
| Tamanho máximo do quadro no serviço | 512 000 bytes |
| Processos do pool | 1 |
| Tamanho mínimo do token de bancada | 32 caracteres |

## Versões

Consultadas em 2026-10-09, no PyPI, no GitHub e no Docker Hub. As quatro bibliotecas de inferência são as
do [ADR 0005](../decisions/0005-backend-unico-em-python.md).

| Dependência | Versão |
| --- | --- |
| `insightface` | 2.1 |
| `onnxruntime` | 1.30.0 |
| `opencv-python-headless` | 5.0.0.93 |
| `numpy` | 2.5.3 |
| `scikit-image` | 0.26.0 |
| Caddy (imagem `caddy`) | `2.11.7-alpine` |

## Modelos

| Arquivo | Origem | SHA-256 |
| --- | --- | --- |
| `det_10g.onnx` | `buffalo_l.zip`, release `v0.7` de `deepinsight/insightface` | `5838f7fe053675b1c7a08b633df49e7af5495cee0493c7dcf6697200b85b5b91` |
| `w600k_r50.onnx` | o mesmo `buffalo_l.zip` | `4c06341c33c2ca1f86781dab0e829f88ad5b64be9fba56e56bc9ebdefc619e43` |
| `2.7_80x80_MiniFASNetV2.onnx` | Release `models-v1` deste repositório | `c9893806bb17f10c4397510b86d9b5b7a17b67e1de25993d9c8174c8aaf1ad0b` |
| `4_0_0_80x80_MiniFASNetV1SE.onnx` | Release `models-v1` deste repositório | `2897a623f7e9508b317655f28258435ec56f592daeadcc5d1a0360231f0d58a2` |
| `facial_expression_recognition_mobilefacenet_2022july.onnx` | `opencv/opencv_zoo`, commit `47534e27c9851bb1128ccc0102f1145e27f23f98` | `4f61307602fc089ce20488a31d4e4614e3c9753a7d6c41578c854858b183e1a9` |

O `buffalo_l.zip` tem SHA-256 `80ffe37d8a5940d59a7384c201a2a38d4741f2f3c51eef46ebb28218a7b0ca2f`. Dos
cinco arquivos dele, só os dois da tabela são extraídos. Os dois ONNX do MiniFASNet são os convertidos
no [levantamento de vivacidade](../research/liveness/README.md).

---

## Acceptance Criteria

### Contrato

**Pacote** — `packages/pipeline`, importado como `pipeline`.

| Função | Entrada | Saída |
| --- | --- | --- |
| `process_frame` | `frame: bytes`, `purpose: Purpose` | `Accepted` ou `Refusal` |

**Comando** — `uv run download-models`, em `packages/pipeline`. Baixa os cinco arquivos da tabela de
modelos para `PIPELINE_MODEL_DIR` e confere o SHA-256 de cada um.

**Serviço**

| Método | Rota | Auth / Role | Idempotente |
| --- | --- | --- | --- |
| WebSocket | `/v1/cameras/stream?purpose=<finalidade>` | `Authorization: Bearer <BENCH_CAMERA_TOKEN>` | N/A |

A rota só é alcançada pelo Proxy TLS, em `wss://`.

### Request

**`process_frame`**

| Campo | Tipo | Obrigatório | Validação |
| --- | --- | --- | --- |
| `frame` | `bytes` | Sim | Um JPEG. Bytes que não decodificam como imagem são recusados com `invalid_image` |
| `purpose` | `Purpose` | Sim | `enrollment` ou `recognition` |

**`/v1/cameras/stream`**

| Campo | Tipo | Obrigatório | Validação |
| --- | --- | --- | --- |
| `purpose` (query) | `string` | Sim | `enrollment` ou `recognition` |
| `Authorization` (cabeçalho) | `string` | Sim | `Bearer ` seguido do valor de `BENCH_CAMERA_TOKEN` |
| mensagem binária | `bytes` | — | Um quadro JPEG inteiro por mensagem, de até 512 000 bytes |

Mensagem de texto é ignorada.

### Response

**`process_frame`** devolve um de dois tipos, ambos imutáveis.

`Accepted`:

| Campo | Tipo | Conteúdo |
| --- | --- | --- |
| `vector` | matriz `float32` de 512 posições | O vetor do rosto, com norma 1 |
| `emotion` | `Emotion` ou `None` | `None` em `enrollment`, em falha da inferência e com confiança abaixo de 0,40 |
| `measurements` | `Measurements` | As medidas de todas as etapas |

`Refusal`:

| Campo | Tipo | Conteúdo |
| --- | --- | --- |
| `reason` | `RefusalReason` | O motivo da recusa |
| `measurements` | `Measurements` | As medidas das etapas executadas; `None` nas demais |

`Emotion`: `label` (um dos sete rótulos) e `confidence` (`float` de 0 a 1).

`Measurements`: `face_side_px`, `yaw_ratio`, `roll_degrees`, `brightness`, `sharpness` e
`liveness_score`, cada um `float` ou `None`.

| `RefusalReason` | Quando |
| --- | --- |
| `invalid_image` | Os bytes não decodificam como imagem |
| `no_face` | A detecção não encontra rosto |
| `multiple_faces` | A detecção encontra dois rostos ou mais |
| `face_too_small` | O menor lado da caixa do rosto tem menos de 50 px |
| `not_frontal` | `yaw_ratio` acima de 0,35 ou `roll_degrees` acima de 25,0 |
| `too_dark` | Brilho médio abaixo de 40,0 |
| `too_bright` | Brilho médio acima de 220,0 |
| `blurry` | Nitidez igual ou abaixo de 100,0 |
| `spoof` | A classe vencedora da vivacidade não é a de rosto real |

Rótulos de emoção, na ordem da saída do modelo: `angry`, `disgust`, `fearful`, `happy`, `neutral`, `sad`,
`surprised`.

**`/v1/cameras/stream`** não envia mensagem à câmera.

| Desfecho | Quando |
| --- | --- |
| Conexão aceita | Token correto e `purpose` válido |
| Handshake recusado com `403` | Cabeçalho ausente, token diferente, ou `purpose` ausente ou fora do domínio |
| Fechamento com código `1009` | Mensagem binária acima de 512 000 bytes |

### Perfis e privilégios

| Papel | Permissão | Observação |
| --- | --- | --- |
| câmera de bancada | `/v1/cameras/stream` | Autentica com `BENCH_CAMERA_TOKEN`; não pertence a nenhuma instituição |
| `manager`, `teacher` | nenhuma rota nova | — |
| sem autenticação | nenhuma rota nova | `GET /health` e `POST /v1/auth/login` continuam sendo as únicas |

---

## Regras de Negócio

### 1. Autorização

- A rota confere o cabeçalho `Authorization` antes de aceitar a conexão, comparando o token em tempo
  constante. Sem o cabeçalho ou com token diferente, o handshake é recusado com `403` e nenhum quadro é
  lido.
- `purpose` ausente ou fora do domínio recusa o handshake com `403`.
- `BENCH_CAMERA_TOKEN` tem pelo menos 32 caracteres e nunca aparece em log, em mensagem de erro nem em
  resposta.
- Este token é provisório. Ele não identifica câmera nem instituição, e o épico #177 o remove ao criar a
  credencial por câmera.
- `process_frame` não tem autorização própria: quem o chama é o serviço ou o harness do artigo.

### 2. Ordem das etapas

Decodificação, detecção, qualidade, vivacidade, vetor e, em `recognition`, emoção. A primeira recusa
encerra o processamento, e as etapas seguintes não executam.

### 3. Detecção e um rosto por quadro

- A detecção é o módulo `detection` do `buffalo_l`, com entrada de 640×640 e pontuação mínima de 0,5.
- Nenhum rosto recusa com `no_face`. Dois ou mais recusam com `multiple_faces`
  ([BR-02](../requirements/business-rules.md#br-02)).

### 4. Qualidade

Calculada sobre a caixa e os cinco pontos que a detecção devolve, na ordem `[olho esquerdo, olho direito,
nariz, canto esquerdo da boca, canto direito da boca]`, e sobre o recorte da caixa em cinza. As
verificações rodam nesta ordem, e a primeira que falha é o motivo
([FR-BIO-02](../requirements/functional/biometrics.md#fr-bio-02)):

| Ordem | Medida | Cálculo | Recusa |
| --- | --- | --- | --- |
| 1 | `face_side_px` | o menor entre largura e altura da caixa | abaixo de 50: `face_too_small` |
| 2 | `yaw_ratio` | `abs(dist(olho esquerdo, nariz) − dist(olho direito, nariz)) / dist(olho esquerdo, olho direito)` | acima de 0,35: `not_frontal` |
| 2 | `roll_degrees` | `abs(atan2(olho direito.y − olho esquerdo.y, olho direito.x − olho esquerdo.x))`, em graus | acima de 25,0: `not_frontal` |
| 3 | `brightness` | média do recorte em cinza | abaixo de 40,0: `too_dark`; acima de 220,0: `too_bright` |
| 4 | `sharpness` | variância do Laplaciano do recorte em cinza | igual ou abaixo de 100,0: `blurry` |

### 5. Vivacidade

- Roda em `enrollment` e em `recognition`
  ([FR-BIO-03](../requirements/functional/biometrics.md#fr-bio-03)).
- O rosto é recortado com fator 2,7 para o MiniFASNetV2 e 4,0 para o MiniFASNetV1SE, redimensionado para
  80×80, em BGR, `float32` de 0 a 255, sem normalização.
- Cada modelo devolve três classes. Aplica-se softmax a cada saída e as duas são somadas. A classe `1` é
  rosto real.
- `liveness_score` é a soma da classe `1` dividida por 2.
- Quando a classe de maior soma não é a `1`, o quadro é recusado com `spoof`.

### 6. Vetor

O vetor é a saída do módulo `recognition` do `buffalo_l` sobre o rosto alinhado, normalizada para norma
1: 512 posições `float32`. Ele só existe em um resultado `Accepted`.

### 7. Emoção

- Roda só em `recognition`, depois do vetor
  ([FR-AFF-01](../requirements/functional/affective.md#fr-aff-01)).
- O pré-processamento é o de `facial_fer_model.py` do OpenCV Zoo, no commit da tabela de modelos.
- `label` é a classe de maior probabilidade e `confidence` é essa probabilidade.
- Com `confidence` abaixo de 0,40, ou com qualquer exceção na inferência, `emotion` é `None` e o
  resultado continua `Accepted`, com o vetor.

### 8. O quadro só em memória

- `process_frame` não grava arquivo, nem temporário, e não inclui o quadro nem um recorte dele em
  exceção ou em log ([BR-01](../requirements/business-rules.md#br-01)).
- O serviço entrega os bytes da mensagem ao pool e não os guarda depois disso.
- Nenhuma linha de log traz o quadro nem o vetor.

### 9. Modelos e ambiente

- `process_frame` lê os cinco arquivos de `PIPELINE_MODEL_DIR` na primeira chamada do processo. Com a
  variável ausente ou um arquivo faltando, a chamada levanta a exceção do próprio Python e nenhum modelo
  é baixado nesse momento.
- `download-models` baixa cada arquivo que falta, confere o SHA-256 de todos e imprime
  `"models ready: <diretório>"`. Com um SHA-256 diferente, apaga o arquivo, encerra com código diferente
  de zero e imprime `"checksum mismatch: <arquivo>"`.
- O serviço ganha duas variáveis obrigatórias, sem valor padrão:

| Variável | Formato |
| --- | --- |
| `PIPELINE_MODEL_DIR` | Caminho de um diretório existente |
| `BENCH_CAMERA_TOKEN` | Texto de pelo menos 32 caracteres |

### 10. Processamento no serviço

- O serviço mantém um pool de 1 processo, criado na inicialização e encerrado no desligamento. Só o
  processo do pool importa `pipeline`.
- Cada mensagem binária é entregue ao pool com a finalidade da conexão.
- Uma mensagem que chega enquanto o pool processa outro quadro é descartada, com a linha de log
  `frame_dropped`.
- Se `process_frame` levanta exceção, ou o processo do pool morre, o serviço grava `inference_failed`,
  recria o pool quando ele morreu e mantém a conexão e as demais rotas no ar.
- O orçamento de tempo não é aplicado neste épico.

### 11. Proxy TLS

- O Caddy é o único contêiner que publica porta no host. O contêiner `api` deixa de publicar a dele.
- Ele termina o TLS com o certificado e a chave em `infra/proxy/certs/server.pem` e `server.key`, fora do
  git, emitidos pela CA própria cujo `ca.pem` é embutido no firmware.
- Ele encaminha todo o tráfego ao serviço e não registra corpo de requisição.
- A porta publicada vem da variável `PROXY_PORT`, que substitui `API_PORT` em `infra/.env.example`.
- O proxy descarta o `X-Forwarded-For` que o cliente envia e grava o endereço real da conexão. O serviço
  confia nesse cabeçalho de toda a rede do compose (`--forwarded-allow-ips '*'`), porque só o proxy
  alcança o contêiner `api`. A chave de IP da cota do login continua sendo o endereço do cliente.

### 12. Firmware de bancada

- O firmware ganha a opção `BENCH_CAMERA_TOKEN` no `menuconfig`, sem valor padrão, e envia
  `Authorization: Bearer <token>` na abertura do WebSocket. O build falha com ela vazia.
- `BENCH_SERVER_URI` passa a ser `wss://<host>:<porta>/v1/cameras/stream?purpose=<finalidade>`.

### 13. Persistência e Auditoria

- **Tabelas/colunas alteradas:** N/A — o épico não grava no banco.
- **Auditoria:** N/A — o registro de auditoria nasce no épico #175.
- **Eventos/integrações disparados:** as três linhas de log abaixo, em JSON, pelo `structlog`.

| `event` | Campos | Quando |
| --- | --- | --- |
| `frame_processed` | `purpose`, `outcome` (`accepted` ou `refused`), `reason`, `emotion`, `emotion_confidence`, `duration_ms` | `process_frame` devolveu um resultado |
| `frame_dropped` | `purpose`, `reason` igual a `busy` | O quadro chegou com outro em processamento |
| `inference_failed` | `purpose`, `error` com o nome da classe da exceção | `process_frame` levantou exceção ou o processo do pool morreu |

Um campo sem valor sai como `null`.

---

## Erros

| Código | HTTP | Quando | Mensagem |
| --- | --- | --- | --- |
| handshake recusado | `403` | Token ausente ou diferente; `purpose` ausente ou fora do domínio | sem corpo |
| fechamento `1009` | — | Mensagem binária acima de 512 000 bytes | sem motivo |
| `checksum mismatch` | — | `download-models` encontra SHA-256 diferente | "checksum mismatch: <arquivo>" |

As recusas de `process_frame` não são erros: são o valor `Refusal`, com os motivos da tabela de
`RefusalReason`. A mensagem que o gestor lê para cada motivo é definida na spec do épico #175.

## Efeitos Colaterais

- **Persistência:** `download-models` grava os cinco arquivos em `PIPELINE_MODEL_DIR`. Nada mais é
  gravado.
- **Concorrência:** um quadro por vez. O que chega durante o processamento de outro é descartado.
- **Transação:** N/A — não há escrita em banco.

---

## Cenários de Aceite (Gherkin)

Os cenários 1 a 10 são conferidos por teste, com a saída dos modelos simulada. Os cenários 11 a 15 são
conferidos por teste do serviço, com `process_frame` substituído. Os cenários 16 a 20 são conferidos na
bancada, com os modelos reais e a ESP32-CAM.

### Cenário 1 — Quadro de reconhecimento aceito (caminho feliz)

```gherkin
Dado um quadro com um rosto dentro de todos os limiares e classificado como rosto real
Quando `process_frame` é chamado com `purpose` igual a `recognition`
Então o resultado é `Accepted` com um vetor `float32` de 512 posições e norma 1
E `emotion` traz um dos sete rótulos e a confiança
E `measurements` traz as seis medidas preenchidas
```

### Cenário 2 — Quadro de cadastro aceito (caminho alternativo)

```gherkin
Dado o mesmo quadro do Cenário 1
Quando `process_frame` é chamado com `purpose` igual a `enrollment`
Então o resultado é `Accepted` com o vetor
E `emotion` é `None`
E o modelo de emoção não é executado
```

### Cenário 3 — Bytes que não são imagem (exceção)

```gherkin
Dado um `frame` cujos bytes não decodificam como imagem
Quando `process_frame` é chamado
Então o resultado é `Refusal` com `reason` igual a `invalid_image`
E nenhum modelo é executado
```

### Cenário 4 — Nenhum rosto (exceção)

```gherkin
Dado um quadro em que a detecção não encontra rosto
Quando `process_frame` é chamado
Então o resultado é `Refusal` com `reason` igual a `no_face`
```

### Cenário 5 — Dois rostos (exceção)

```gherkin
Dado um quadro em que a detecção encontra dois rostos
Quando `process_frame` é chamado
Então o resultado é `Refusal` com `reason` igual a `multiple_faces`
E a vivacidade e o vetor não são executados
```

### Cenário 6 — Quadro abaixo de um limiar de qualidade (exceção)

```gherkin
Dado um quadro com um rosto cuja medida viola um limiar
Quando `process_frame` é chamado
Então o resultado é `Refusal` com o motivo do limiar violado:
  | medida                              | motivo           |
  | `face_side_px` de 49                | `face_too_small` |
  | `yaw_ratio` de 0,36                 | `not_frontal`    |
  | `roll_degrees` de 25,1              | `not_frontal`    |
  | `brightness` de 39,9                | `too_dark`       |
  | `brightness` de 220,1               | `too_bright`     |
  | `sharpness` de 100,0                | `blurry`         |
E a vivacidade e o vetor não são executados
```

### Cenário 7 — Ordem das recusas de qualidade (caminho alternativo)

```gherkin
Dado um quadro com um rosto de 49 px de lado e brilho de 39,9
Quando `process_frame` é chamado
Então o resultado é `Refusal` com `reason` igual a `face_too_small`
```

### Cenário 8 — Foto ou tela recusada pela vivacidade (exceção)

```gherkin
Dado um quadro dentro dos limiares de qualidade
E a soma das saídas dos dois modelos de vivacidade tem a maior probabilidade fora da classe `1`
Quando `process_frame` é chamado com `enrollment` e depois com `recognition`
Então os dois resultados são `Refusal` com `reason` igual a `spoof`
E `liveness_score` vem preenchido em `measurements`
E nenhum vetor é devolvido
```

### Cenário 9 — Emoção com confiança baixa (caminho alternativo)

```gherkin
Dado um quadro de reconhecimento aceito cuja classe de emoção mais provável tem probabilidade 0,39
Quando `process_frame` é chamado
Então o resultado é `Accepted` com o vetor
E `emotion` é `None`
```

### Cenário 10 — Falha na inferência de emoção (exceção)

```gherkin
Dado um quadro de reconhecimento aceito
E o modelo de emoção levanta exceção
Quando `process_frame` é chamado
Então o resultado é `Accepted` com o vetor
E `emotion` é `None`
```

### Cenário 11 — Câmera autenticada entrega um quadro (caminho feliz)

```gherkin
Dado o serviço com `BENCH_CAMERA_TOKEN` definido
Quando um cliente abre `/v1/cameras/stream?purpose=recognition` com `Authorization: Bearer <token>`
E envia um quadro como mensagem binária
Então a conexão é aceita
E o serviço grava uma linha `frame_processed` com `purpose`, `outcome` e `duration_ms`
E a linha não contém o quadro, o vetor nem o token
```

### Cenário 12 — Conexão sem token ou com token errado (autorização negada)

```gherkin
Dado o serviço com `BENCH_CAMERA_TOKEN` definido
Quando um cliente abre `/v1/cameras/stream?purpose=recognition` sem `Authorization`
E outro cliente abre a mesma rota com um token diferente
Então os dois handshakes são recusados com `403`
E `process_frame` não é chamado
```

### Cenário 13 — Finalidade fora do domínio (exceção)

```gherkin
Dado um cliente com o token correto
Quando abre `/v1/cameras/stream?purpose=attendance`, ou a rota sem `purpose`
Então o handshake é recusado com `403`
```

### Cenário 14 — Quadro acima do tamanho (exceção)

```gherkin
Dado uma conexão aceita
Quando o cliente envia uma mensagem binária de 512 001 bytes
Então o serviço fecha a conexão com o código `1009`
E `process_frame` não é chamado
```

### Cenário 15 — Quadro durante outro processamento e falha da inferência (exceção)

```gherkin
Dado uma conexão aceita e um quadro em processamento
Quando o cliente envia outro quadro
Então o serviço grava `frame_dropped` com `reason` igual a `busy`
Quando `process_frame` levanta exceção em um quadro seguinte
Então o serviço grava `inference_failed` com o nome da classe da exceção
E a conexão continua aberta
E `GET /health` responde `200`
```

### Cenário 16 — Download dos modelos (caminho feliz)

```gherkin
Dado `PIPELINE_MODEL_DIR` apontando para um diretório vazio
Quando executa `uv run download-models`
Então os cinco arquivos da tabela de modelos existem no diretório, com o SHA-256 da tabela
E o comando imprime "models ready: <diretório>"
Quando um dos arquivos é trocado por outro conteúdo e o comando roda de novo
Então o comando imprime "checksum mismatch: <arquivo>" e encerra com código diferente de zero
```

### Cenário 17 — Quadro real da ESP32-CAM (caminho feliz)

```gherkin
Dado o compose de pé, com o Proxy TLS, os modelos baixados e a câmera gravada com o token e a CA
E Theo ou Vinicius de frente para a câmera
Quando a câmera envia quadros para `wss://<host>:<porta>/v1/cameras/stream?purpose=recognition`
Então o log do serviço traz linhas `frame_processed` com `outcome` igual a `accepted` e um rótulo de emoção
Quando ninguém está diante da câmera
Então as linhas trazem `outcome` igual a `refused` e `reason` igual a `no_face`
```

### Cenário 18 — Foto impressa e tela diante da câmera (exceção)

```gherkin
Dado o ambiente do Cenário 17
Quando uma foto impressa de um dos autores é posta diante da câmera
E depois uma tela mostrando o rosto de um dos autores
Então o log traz linhas `frame_processed` com `reason` igual a `spoof`
E a contagem de quadros aceitos e recusados de cada caso é anotada na issue
```

### Cenário 19 — Só TLS e nada em disco (exceção)

```gherkin
Dado o ambiente do Cenário 17 depois de 100 quadros processados
Quando se listam as portas publicadas pelo compose
Então só o Proxy TLS publica porta, e uma conexão `ws://` sem TLS a ela é recusada
Quando se inspecionam o log do serviço, o log do proxy e os volumes do compose
Então nenhum deles contém um quadro, um recorte dele nem um vetor
```

### Cenário 20 — Cota do login por IP atrás do proxy (exceção)

```gherkin
Dado o ambiente do Cenário 17
Quando um cliente envia `POST /v1/auth/login` pelo proxy com o cabeçalho `X-Forwarded-For: 203.0.113.9`
Então a chave de cota por IP gravada no Redis traz o endereço real do cliente
E não traz `203.0.113.9` nem o endereço do contêiner do proxy
```

---

## Impacto na arquitetura

- **[Pipeline](../architecture/building-blocks/pipeline.md):** passa a existir. Ganha a ordem das
  etapas, os motivos de recusa, o comando `download-models` e `PIPELINE_MODEL_DIR`.
- **[Serviço](../architecture/building-blocks/service.md):** o módulo `devices` ganha a entrada WebSocket
  de bancada, e `app/core` ganha o pool de processos.
- **[Proxy TLS](../architecture/building-blocks/proxy.md):** passa a existir, com Caddy `2.11.7`, no
  ambiente local.
- **[Câmera](../architecture/building-blocks/camera.md):** o firmware de bancada passa a enviar o token e
  a conectar no serviço.
- **[Implantação](../architecture/deployment.md):** o compose ganha o proxy e o volume dos modelos; o
  `api` deixa de publicar porta.
- **[Segurança](../architecture/concepts/security.md):** o token de bancada, provisório até o #177.
- **[Riscos](../architecture/risks.md):** o token de bancada é um segredo único, compartilhado por toda
  câmera, até o #177.
- **[ADR 0007](../decisions/0007-canal-da-camera-por-websocket.md):** emenda com a tecnologia do proxy e
  o token de bancada.
- **Cenários de execução:** N/A — cadastro e reconhecimento continuam descrevendo o fluxo completo, que
  os épicos #175, #177 e #178 constroem.

## Impacto no modelo de dados

N/A — o épico não cria tabela, coluna nem entidade. O vetor e a emoção só são gravados no épico #175.

## Fora de Escopo

- Galeria, comparação 1:N, cadastro biométrico, evento de reconhecimento e auditoria: épico #175.
- A mensagem que o gestor lê para cada motivo de recusa: épico #175.
- Credencial por câmera, registro, revogação e rotação: épico #177.
- Comando de captura com a finalidade e cota por câmera e por instituição
  ([NFR-SEC-03](../requirements/non-functional/security.md#nfr-sec-03)): épico #178.
- Orçamento de tempo, interrupção por estouro e a decisão entre pool e fila: épico #179, com a
  [OQ-03](../requirements/open-questions.md#oq-03).
- Certificado público e ambiente de nuvem do proxy: épico #179.
- Calibração dos limiares e taxa de bloqueio da vivacidade em dataset: harness do artigo, depois da
  [OQ-07](../requirements/open-questions.md#oq-07).
- Resposta do serviço à câmera pelo WebSocket.
- O servidor de bancada `esp32-cam/bench/server.py`, que fica como está para a issue #193.

## Quebra em Tasks

| # | Issue | Título | Escopo | Critério de aceite | Depende de |
| --- | --- | --- | --- | --- | --- |
| 1 | #198 | Criar `packages/pipeline` com o download dos modelos | `packages/pipeline`: projeto `uv`, gates, `AGENTS.md` da área e o comando `download-models`; a Release `models-v1` com os dois ONNX do MiniFASNet | Cenário 16 | — |
| 2 | #199 | Recusar por detecção e qualidade e devolver o vetor | `packages/pipeline`: `process_frame` com decodificação, detecção, qualidade e vetor; os tipos do resultado | Cenários 1 (sem a emoção), 2, 3, 4, 5, 6 e 7 | 1 |
| 3 | #200 | Recusar por vivacidade e inferir a emoção | `packages/pipeline`: as etapas de vivacidade e de emoção | Cenários 1, 8, 9 e 10 | 2 |
| 4 | #201 | Receber o quadro da câmera e entregá-lo ao pool | `apps/api`: a rota em `features/devices`, o pool em `app/core`, as duas variáveis em `Settings` e no `.env.example`, a dependência do pacote e o `Dockerfile` | Cenários 11, 12, 13, 14 e 15 | 3 |
| 5 | #202 | Subir o Proxy TLS e ligar a câmera de bancada ao serviço | `infra`: Caddy, o volume e o serviço de download dos modelos no compose, `PROXY_PORT`; `esp32-cam`: a opção `BENCH_CAMERA_TOKEN` e o cabeçalho; `apps/api`: o `Dockerfile` passa a confiar no cabeçalho do proxy | Cenários 17, 18, 19 e 20 | 4 |
