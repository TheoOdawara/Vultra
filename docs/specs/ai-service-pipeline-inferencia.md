# SPEC-001 — Processar quadro facial no ai-service (detecção, identidade e afeto)

> **Status:** publicada
> **Perfil:** API
> **Módulo:** `apps/ai-service`
> **Epic:** #58
> **Requisitos cobertos:** RF-06, RF-10, RF-14, RF-15, RF-16, RF-22, RNF-01, RNF-06, RNF-07, RNF-10, RNF-11, RNF-12
> **Decisão relacionada:** `docs/decisions/0002-pipeline-de-inferencia-do-ai-service.md`

## Acceptance Criteria

### Contrato

O `ai-service` não expõe superfície HTTP de inferência. O único contrato é a fila Redis.

| Transporte | Chave | Direção | Autenticação |
| --- | --- | --- | --- |
| Redis `LPUSH` / `BLPOP` | `ai:recognition:queue` | `api-core` → `ai-service` | Rede interna; o `ai-service` não publica porta no host |
| Redis `SETEX` / `GET` | `ai:recognition:result:{job_id}` | `ai-service` → `api-core` | TTL de `60 s` |
| HTTP `GET` | `/health` | Sonda do orquestrador | Somente na rede interna do compose |

A superfície HTTP `POST /process-image` é **removida**. A autenticação, a autorização, o rate limiting e a
auditoria pertencem ao `api-core`, em `/v1/face/*`. O `ai-service` recebe apenas trabalho já autorizado.

### Request — `AIJob`

Publicado pelo `api-core` em `ai:recognition:queue` como JSON UTF-8.

| Campo | Tipo | Obrigatório | Validação |
| --- | --- | --- | --- |
| `job_id` | `string` | Sim | UUID v4. Compõe a chave de resultado |
| `frame_base64` | `string` | Sim | JPEG em base64. Máximo `1048576` bytes após decodificação |
| `organization_id` | `string` | Sim | UUID do tenant. Usado em log e métrica, nunca em decisão de acesso |
| `purpose` | `string` | Sim | Um de `enroll`, `verify`, `attendance`. Valor fora do domínio rejeita o job |
| `device_id` | `string \| null` | Não | UUID do ESP32-CAM quando a captura vem de dispositivo |

```json
{
  "job_id": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
  "frame_base64": "/9j/4AAQSkZJRgABAQ...",
  "organization_id": "11111111-1111-1111-1111-111111111111",
  "purpose": "attendance",
  "device_id": "22222222-2222-2222-2222-222222222222"
}
```

### Response — `AIResult`

Publicado em `ai:recognition:result:{job_id}` com `SETEX` e TTL de `60 s`.

**Sucesso, `purpose = attendance`**

```json
{
  "job_id": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
  "embedding": [0.0123, -0.0456, "... 512 floats"],
  "quality_score": 0.87,
  "frontality_score": 0.94,
  "liveness_score": 0.91,
  "sentiment_label": "neutral",
  "sentiment_score": 0.72,
  "processing_ms": 412,
  "model_versions": {
    "detector": "buffalo_l",
    "embedder": "ArcFace-v1",
    "liveness": "MiniFASNetV2-2020",
    "emotion": "mobilefacenet-fer-2022july"
  },
  "error": null
}
```

**Sucesso, `purpose = enroll` ou `verify`**

Idêntico, com `sentiment_label` e `sentiment_score` sempre `null`: a inferência afetiva não é executada
nestes fluxos.

**Erro**

```json
{
  "job_id": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
  "embedding": null,
  "quality_score": null,
  "frontality_score": null,
  "liveness_score": null,
  "sentiment_label": null,
  "sentiment_score": null,
  "processing_ms": 143,
  "model_versions": { "detector": "buffalo_l", "embedder": "ArcFace-v1", "liveness": "MiniFASNetV2-2020", "emotion": "mobilefacenet-fer-2022july" },
  "error": "NOT_FRONTAL"
}
```

| Campo | Tipo | Quando é `null` |
| --- | --- | --- |
| `embedding` | `float[512] \| null` | Sempre que `error` é não-nulo |
| `quality_score` | `float [0,1] \| null` | Quando o pipeline aborta antes da etapa 5 |
| `frontality_score` | `float [0,1] \| null` | Quando o pipeline aborta antes da etapa 4 |
| `liveness_score` | `float [0,1] \| null` | Quando o pipeline aborta antes da etapa 6 |
| `sentiment_label` | `string \| null` | `purpose ≠ attendance`, erro, ou confiança abaixo de `0.40` |
| `sentiment_score` | `float [0,1] \| null` | Mesmas condições de `sentiment_label` |
| `processing_ms` | `int ≥ 0` | Nunca |
| `model_versions` | `object` | Nunca |
| `error` | `string \| null` | Quando o processamento conclui |

`frame_base64` nunca aparece no `AIResult`, em nenhum campo, sob nenhuma condição de erro.

### Perfis e privilégios

`N/A` — o `ai-service` não autentica nem autoriza ninguém. Ele consome uma fila alcançável apenas pela
rede interna e confia que o `api-core` já aplicou autenticação, RBAC e rate limiting em `/v1/face/*`,
conforme `docs/face/README.md`. Esta é a razão de a superfície HTTP de inferência ser removida: um
endpoint aberto contornava inteiramente esses controles, violando RNF-07.

---

## Regras de Negócio

### 1. Ordem do pipeline

As etapas executam na ordem abaixo, da mais barata para a mais cara. **A primeira que reprova encerra o
job**; nenhuma etapa posterior é executada, e o custo dela não é pago.

| # | Etapa | Reprova com | Executa quando |
| --- | --- | --- | --- |
| 1 | Decodificação base64 → BGR em RAM | `INVALID_BASE64`, `FRAME_TOO_LARGE`, `INVALID_IMAGE` | Sempre |
| 2 | Detecção facial (RetinaFace / `buffalo_l`) | `NO_FACE_DETECTED`, `MULTIPLE_FACES` | Sempre |
| 3 | Gate de frontalidade (5 keypoints) | `NOT_FRONTAL` | Sempre |
| 4 | Qualidade do quadro | `LOW_QUALITY` | Sempre |
| 5 | Anti-spoofing (MiniFASNetV2) | `SPOOF_DETECTED` | Sempre |
| 6 | Embedding ArcFace 512d | — | Sempre |
| 7 | Inferência de expressão | Nunca reprova o job | `purpose = attendance` |

A ordem é comportamento observável, não detalhe de implementação: um quadro de perfil e escuro devolve
`NOT_FRONTAL`, nunca `LOW_QUALITY`.

### 2. Exatamente um rosto por quadro

A câmera é única, instalada na porta da sala, e os alunos passam **um por vez**. Zero rostos devolve
`NO_FACE_DETECTED`; dois ou mais devolvem `MULTIPLE_FACES`. Nenhum dos dois registra presença.

Esta regra é uma restrição de produto, não uma limitação técnica: um quadro com dois rostos é ambíguo
quanto a quem está presente, e adivinhar produziria presença falsa.

### 3. Gate de frontalidade

Calculado sobre os cinco keypoints que o `buffalo_l` já devolve na detecção, na ordem
`[olho_esquerdo, olho_direito, nariz, boca_esquerda, boca_direita]`. Nenhum modelo adicional é carregado.

```
yaw_ratio = | ‖olho_esq − nariz‖ − ‖olho_dir − nariz‖ | / ‖olho_esq − olho_dir‖
roll_deg  = | atan2(olho_dir.y − olho_esq.y, olho_dir.x − olho_esq.x) | em graus
```

| Limiar | Valor inicial | Variável |
| --- | --- | --- |
| `yaw_ratio` máximo | `0.35` | `AI_MAX_YAW_RATIO` |
| `roll_deg` máximo | `25.0` | `AI_MAX_ROLL_DEG` |

Qualquer um dos dois excedido devolve `NOT_FRONTAL`. O `frontality_score` publicado é
`round(max(0.0, 1.0 − yaw_ratio / AI_MAX_YAW_RATIO), 4)`.

Os dois valores são iniciais e calibrados contra captura real na Task 13 (issue #72). Um limiar de pose não tem valor
correto derivável em mesa: depende da altura de instalação da câmera e da distância de passagem.

### 4. Qualidade do quadro

Mantém as regras já implementadas em `validators/frame_validator.py`, sem alteração de limiar:

| Regra | Limiar | Variável |
| --- | --- | --- |
| Menor lado da bounding box | `≥ 50 px` | `MIN_FACE_PX` |
| Variância do Laplaciano (nitidez) | `> 100.0` | `MIN_BLUR_LAPLACIAN` |
| Brilho médio da região facial | `40.0` a `220.0` | `MIN_BRIGHTNESS` / `MAX_BRIGHTNESS` |
| Centralização em x e y | `0.30` a `0.70` | — |
| `quality_score` composto | `≥ 0.40` | `MIN_QUALITY_SCORE` |

O `ai-service` reprova abaixo de `0.40`. O `api-core` aplica um segundo gate, mais estrito, de `0.50` no
enroll (`docs/face/README.md`). São dois gates deliberadamente distintos: cadastrar um rosto exige mais
qualidade que reconhecê-lo, porque o erro de cadastro contamina toda captura futura.

### 5. Anti-spoofing

Modelo `MiniFASNetV2` em ONNX, entrada BGR `80×80` recortada da bounding box com fator de escala `2.7`,
saída softmax de três classes `[live, print_attack, replay_attack]`.

| Limiar | Valor inicial | Variável |
| --- | --- | --- |
| `liveness_score` mínimo | `0.70` | `AI_MIN_LIVENESS` |

`liveness_score` é a probabilidade da classe `live`. Abaixo do limiar o job devolve `SPOOF_DETECTED`, sem
embedding e sem presença. O `api-core` registra a tentativa em `audit_logs`.

Geometria de landmarks **não** substitui este modelo: uma foto impressa produz exatamente o mesmo
triângulo olhos-nariz-boca que o rosto real. A distinção é de textura, e exige modelo dedicado.

### 6. Inferência de expressão facial

Modelo `facial_expression_recognition_mobilefacenet_2022july.onnx` (OpenCV Zoo, Apache-2.0), entrada
`[1, 3, 112, 112]` float32, saída `[1, 7]` softmax. Executa **somente** quando `purpose = attendance`.

Mapeamento literal da saída do modelo para o domínio persistido em `attendance_records.sentiment_label`:

| Índice de saída | Rótulo do modelo | `sentiment_label` gravado |
| --- | --- | --- |
| 0 | `angry` | `angry` |
| 1 | `disgust` | `disgust` |
| 2 | `fearful` | `fear` |
| 3 | `happy` | `happy` |
| 4 | `neutral` | `neutral` |
| 5 | `sad` | `sad` |
| 6 | `surprised` | `surprise` |

| Limiar | Valor inicial | Variável |
| --- | --- | --- |
| Confiança mínima | `0.40` | `AI_MIN_EMOTION_CONFIDENCE` |

`sentiment_score` é a probabilidade da classe dominante. Abaixo de `0.40`, **ambos** `sentiment_label` e
`sentiment_score` são `null` e o motivo é registrado em log com o `job_id`. A abstenção é dado: a taxa de
abstenção é reportada no artigo, e chutar um rótulo corromperia a distribuição que o artigo mede.

A inferência afetiva **nunca reprova o job**. Falha de carga do modelo, exceção de inferência ou confiança
insuficiente produzem `sentiment_label = null` com a presença registrada normalmente. A presença é o
produto direto; o afeto é subproduto e degrada sozinho.

### 7. Orçamento de tempo

| Escopo | Orçamento | Onde é imposto |
| --- | --- | --- |
| Ponta a ponta, do `LPUSH` à leitura do resultado | `3000 ms` | `api-core`, `ai-job.queue.ts` |
| Processamento de um job, após sair da fila | `2000 ms` | `ai-service`, `AI_JOB_TIMEOUT_MS` |

O orçamento do `ai-service` é **estritamente menor** que o do `api-core`, e a diferença de `1000 ms`
cobre espera em fila, latência de rede e o intervalo de leitura do resultado. Hoje os dois valem `3000 ms`,
o que permite ao `ai-service` concluir e publicar um resultado que o `api-core` já descartou — CPU gasta
para produzir dado que ninguém lê.

Estourado o orçamento, o job devolve `PROCESSING_TIMEOUT` e **a inferência em curso é efetivamente
interrompida**. Cancelar o `Future` de um executor não interrompe a thread: sem isso, a inferência
abandonada continua consumindo CPU e atrasa o job seguinte.

Latências medidas em CPU (Apple Silicon, `onnxruntime` 1.28.0):

| Modelo | Latência por inferência | Arquivo |
| --- | --- | --- |
| FER fp32 | `6.84 ms` | `4.6 MB` |
| FER int8 | `13.92 ms` | `1.3 MB` |

A variante int8 é `2×` mais lenta que a fp32 neste alvo. **Fica a fp32.** Quantização só compensa onde
existe kernel otimizado para ela.

### 8. Detecção em `320×320`

`det_size` passa de `(640, 640)` para `(320, 320)`, via `AI_DET_SIZE`. A detecção é o item mais caro do
pipeline e seu custo cresce com o quadrado do lado. A ESP32-CAM entrega quadro pequeno; detectar em `640`
amplia ruído de sensor sem acrescentar informação.

O valor é calibrado na Task 13 (issue #72) contra captura real da câmera instalada na porta.

### 9. Processamento concorrente

O worker processa até `AI_WORKER_CONCURRENCY = 4` jobs simultaneamente. Hoje o consumo é sequencial —
`BLPOP`, processa, só então o próximo — enquanto um `ThreadPoolExecutor(max_workers=4)` permanece ocioso.
Com consumo sequencial, o segundo aluno da fila já começa com boa parte do orçamento consumido em espera.

Um job cujo payload não valida contra `AIJob` publica `AIResult` com `error = "INVALID_JOB_PAYLOAD"`
**sempre que o `job_id` for extraível** do payload bruto. O descarte silencioso só ocorre quando nem o
`job_id` pode ser lido, caso em que não existe chave de resultado a escrever.

O descarte silencioso incondicional é um defeito: sem resultado, o `api-core` espera os `3000 ms`
completos, lança `AIJobTimeoutError` e **conta uma falha no circuit breaker**. Cinco payloads malformados
seguidos abrem o circuito e derrubam a biometria do tenant por `30 s` — um erro de serialização do
produtor vira indisponibilidade. A falha é do `api-core`, que produziu o payload; puni-lo com perda de
disponibilidade não corrige nada e esconde a causa.

### 10. Configuração sem valor padrão

Nenhuma variável de ambiente tem valor padrão no ponto de leitura. Todas são obrigatórias e validadas na
inicialização; faltando qualquer uma, o processo encerra com código diferente de zero e mensagem nomeando
a variável ausente e o formato esperado.

Hoje `config.py` fornece padrão para todas — inclusive `redis_url`, com `redis://localhost:6379`. Um
container sem `REDIS_URL` sobe, responde `/health` com `ok`, e nunca consome um único job. Isso viola
RNF-06 e produz falha silenciosa.

| Variável | Formato |
| --- | --- |
| `REDIS_URL` | `redis://[:senha@]host:porta` |
| `AI_QUEUE_NAME` | string não vazia |
| `AI_RESULT_PREFIX` | string não vazia terminada em `:` |
| `AI_RESULT_TTL_S` | inteiro `≥ 1` |
| `AI_JOB_TIMEOUT_MS` | inteiro `≥ 1` |
| `AI_WORKER_CONCURRENCY` | inteiro `≥ 1` |
| `AI_MAX_PAYLOAD_BYTES` | inteiro `≥ 1` |
| `AI_DET_SIZE` | inteiro `≥ 64` |
| `AI_MAX_YAW_RATIO` | float `> 0.0` |
| `AI_MAX_ROLL_DEG` | float `> 0.0` |
| `AI_MIN_LIVENESS` | float em `[0.0, 1.0]` |
| `AI_MIN_EMOTION_CONFIDENCE` | float em `[0.0, 1.0]` |
| `AI_MODEL_NAME` | string não vazia |
| `AI_EMOTION_MODEL_PATH` | caminho absoluto de arquivo `.onnx` |
| `AI_LIVENESS_MODEL_PATH` | caminho absoluto de arquivo `.onnx` |
| `AI_HOST` | endereço IP |
| `AI_PORT` | inteiro `1`–`65535` |

Os valores de desenvolvimento vivem em `.env.example`, que é o contrato para quem preenche a cópia local.

### 11. Somente os módulos consumidos são carregados

`FaceAnalysis` é instanciado com `allowed_modules=["detection", "recognition"]`. Nenhum outro módulo do
`buffalo_l` é carregado ou executado.

Sem esse parâmetro — que é o estado atual — o pacote executa cinco módulos por captura: detecção,
reconhecimento, landmarks 2D, landmarks 3D e **gênero/idade**. O código consome apenas `bbox`, `kps` e
`embedding`; a saída dos outros três é descartada.

Isso tem duas consequências, e a segunda é a grave:

1. **Custo.** Três inferências por quadro cujo resultado ninguém lê, no caminho quente, competindo com o
   orçamento da Regra 7. Pesa mais que o ganho da Regra 8.
2. **Conformidade.** O serviço infere **gênero e idade de alunos** hoje. Nenhum requisito pede esse dado,
   nenhuma finalidade para ele está declarada, e `docs/requirements.md` não o menciona em lugar nenhum.
   RNF-03 exige base legal, finalidade e prazo de retenção declarados para cada operação sobre dado
   sensível — e o titular é possivelmente menor de idade. Não é desperdício de CPU: é tratamento de dado
   pessoal sem base legal, produzido a cada captura.

Módulo novo entra apenas por inclusão explícita em `allowed_modules`, nunca por padrão do pacote.

### 12. Persistência e Auditoria

- **Tabelas/colunas alteradas:** nenhuma. O `ai-service` não acessa banco.
- **Persistência em disco:** nenhuma. O quadro existe apenas como `bytes` e `numpy.ndarray` em RAM,
  descartados ao fim do job (RNF-01).
- **Auditoria:** responsabilidade do `api-core`, que grava `audit_logs` a partir do `AIResult`. O
  `ai-service` emite log estruturado com `job_id`, `organization_id`, `purpose`, `error` e
  `processing_ms` — e **nunca** `frame_base64`, `embedding` ou qualquer recorte de imagem.
- **Eventos/integrações disparados:** somente o `SETEX` da chave de resultado.

---

## Erros

Códigos publicados no campo `error` do `AIResult`. A mensagem literal exibida ao usuário é
responsabilidade do `api-core`; a coluna abaixo fixa o mapeamento HTTP que ele deve aplicar em
`/v1/face/*`.

| Código | HTTP no `api-core` | Quando | Mensagem literal do `api-core` |
| --- | --- | --- | --- |
| `INVALID_BASE64` | `422` | `frame_base64` não decodifica como base64 válido | "Não foi possível ler a captura enviada." |
| `FRAME_TOO_LARGE` | `413` | Quadro decodificado acima de `1048576` bytes | "A captura excede o tamanho máximo de 1 MB." |
| `INVALID_IMAGE` | `422` | Bytes decodificam mas não são uma imagem JPEG válida | "Não foi possível ler a captura enviada." |
| `NO_FACE_DETECTED` | `422` | Nenhum rosto detectado no quadro | "Nenhum rosto foi encontrado na captura." |
| `MULTIPLE_FACES` | `422` | Dois ou mais rostos no quadro | "Mais de um rosto foi encontrado. Passe um aluno por vez." |
| `NOT_FRONTAL` | `422` | `yaw_ratio > 0.35` ou `roll_deg > 25.0` | "Olhe para a câmera de frente." |
| `LOW_QUALITY` | `422` | `quality_score < 0.40` ou qualquer regra da Regra 4 reprovada | "A qualidade da captura é insuficiente." |
| `SPOOF_DETECTED` | `422` | `liveness_score < 0.70` | "A captura não corresponde a uma pessoa presente." |
| `PROCESSING_TIMEOUT` | `503` | Processamento excedeu `2000 ms` | "O reconhecimento demorou mais que o esperado. Tente novamente." |
| `INTERNAL_ERROR` | `503` | Exceção não prevista durante o processamento | "Não foi possível processar a captura." |
| `MODEL_NOT_READY` | `503` | Job consumido antes de os modelos carregarem | "O serviço de reconhecimento ainda está iniciando." |
| `INVALID_JOB_PAYLOAD` | `500` | Payload publicado pelo `api-core` não valida contra `AIJob` | "Não foi possível processar a captura." |

`INVALID_JOB_PAYLOAD` indica defeito do produtor, não indisponibilidade do `ai-service`: o `api-core`
**não** contabiliza falha no circuit breaker ao recebê-lo, e registra o erro para investigação.

Nenhuma mensagem ecoa o corpo da requisição, o `frame_base64` ou detalhe interno de exceção (RNF-11).

## Efeitos Colaterais

- **Persistência:** nenhuma no `ai-service`. A única escrita é `SETEX ai:recognition:result:{job_id}` com
  TTL de `60 s`.
- **Concorrência:** até `4` jobs em processamento simultâneo. Cada job é independente; não há estado
  compartilhado entre eles além das sessões ONNX, que são somente leitura após a carga. Dois jobs com o
  mesmo `job_id` produzem duas escritas na mesma chave, e a última vence — o `api-core` gera `job_id`
  único por requisição, e nada no `ai-service` depende dessa unicidade.
- **Transação:** `N/A` — não há banco nem operação multi-chave.
- **Ciclo de vida dos modelos:** as três sessões ONNX (detector/embedder via InsightFace, liveness,
  emoção) carregam na inicialização, antes de o worker consumir o primeiro job. `/health` responde
  `degraded` até as três estarem prontas.

---

## Cenários de Aceite (Gherkin)

### Cenário 1 — Presença reconhecida com afeto inferido (caminho feliz)

```gherkin
Dado que os três modelos estão carregados
E um job válido com purpose "attendance" e um quadro frontal, nítido e de pessoa real
Quando o worker consome o job da fila ai:recognition:queue
Então o resultado é publicado em ai:recognition:result:{job_id} com TTL de 60 segundos
E embedding contém exatamente 512 floats
E quality_score, frontality_score e liveness_score estão em [0.0, 1.0]
E sentiment_label é um dos sete rótulos do domínio
E sentiment_score é maior ou igual a 0.40
E error é null
E o corpo publicado não contém a string de frame_base64
```

### Cenário 2 — Enroll não infere afeto (caminho alternativo)

```gherkin
Dado um job válido com purpose "enroll" e um quadro que passa em todos os gates
Quando o worker processa o job
Então embedding contém 512 floats
E sentiment_label é null
E sentiment_score é null
E o modelo de expressão não é invocado
```

### Cenário 3 — Rosto de perfil é recusado antes do custo do embedding

```gherkin
Dado um job cujo quadro tem yaw_ratio igual a 0.50
Quando o worker processa o job
Então error é "NOT_FRONTAL"
E embedding é null
E liveness_score é null
E o modelo de embedding não é invocado
E o modelo de anti-spoofing não é invocado
```

### Cenário 4 — Foto impressa é bloqueada

```gherkin
Dado um job cujo quadro passa em frontalidade e qualidade
E cujo liveness_score inferido é 0.30
Quando o worker processa o job
Então error é "SPOOF_DETECTED"
E embedding é null
E nenhuma presença pode ser registrada a partir deste resultado
```

### Cenário 5 — Dois rostos no quadro

```gherkin
Dado um job cujo quadro contém dois rostos detectados
Quando o worker processa o job
Então error é "MULTIPLE_FACES"
E embedding é null
E o gate de frontalidade não é executado
```

### Cenário 6 — Nenhum rosto no quadro

```gherkin
Dado um job cujo quadro não contém rosto algum
Quando o worker processa o job
Então error é "NO_FACE_DETECTED"
E embedding é null
```

### Cenário 7 — Afeto abstém sem derrubar a presença

```gherkin
Dado um job com purpose "attendance" que passa em todos os gates
E cuja classe de expressão dominante tem probabilidade 0.31
Quando o worker processa o job
Então error é null
E embedding contém 512 floats
E sentiment_label é null
E sentiment_score é null
E o log registra a abstenção com o job_id
```

### Cenário 8 — Falha do modelo de expressão não derruba a presença

```gherkin
Dado um job com purpose "attendance" que passa em todos os gates
E que o modelo de expressão lança exceção durante a inferência
Quando o worker processa o job
Então error é null
E embedding contém 512 floats
E sentiment_label é null
E a exceção é registrada em log sem qualquer dado de imagem
```

### Cenário 9 — Quadro de baixa qualidade

```gherkin
Dado um job cujo quadro é frontal mas cuja variância do Laplaciano é 40.0
Quando o worker processa o job
Então error é "LOW_QUALITY"
E embedding é null
E o modelo de anti-spoofing não é invocado
```

### Cenário 10 — Quadro acima do limite de tamanho

```gherkin
Dado um job cujo frame_base64 decodifica para 2097152 bytes
Quando o worker processa o job
Então error é "FRAME_TOO_LARGE"
E nenhum modelo é invocado
```

### Cenário 11 — Base64 inválido

```gherkin
Dado um job cujo frame_base64 é "isto-nao-e-base64!!!"
Quando o worker processa o job
Então error é "INVALID_BASE64"
E nenhum modelo é invocado
```

### Cenário 12 — Orçamento de tempo estourado

```gherkin
Dado um job cujo processamento excede 2000 ms
Quando o orçamento se esgota
Então error é "PROCESSING_TIMEOUT"
E o resultado é publicado antes de o api-core atingir seus 3000 ms
E a inferência abandonada deixa de consumir CPU dentro de 100 ms
```

### Cenário 13 — Payload inválido com job_id legível devolve erro

```gherkin
Dado um payload na fila cujo job_id é legível mas que não valida contra o schema AIJob
Quando o worker o consome
Então o resultado é publicado com error igual a "INVALID_JOB_PAYLOAD"
E o api-core recebe o erro antes de esgotar os 3000 ms
E o circuit breaker não contabiliza falha de indisponibilidade
E o worker continua consumindo a fila
E o log não contém o conteúdo do payload
```

### Cenário 20 — Payload ilegível é descartado

```gherkin
Dado um payload na fila do qual nem o job_id pode ser extraído
Quando o worker o consome
Então nenhuma chave de resultado é escrita no Redis
E o worker continua consumindo a fila
```

### Cenário 22 — Divergência de contrato quebra o gate

```gherkin
Dado o contrato da fila com fonte única em packages/types
Quando um campo é removido da definição única
Então a verificação de contrato falha no api-core
E o teste de contrato do ai-service falha
E nenhum dos dois lados passa no gate
```

### Cenário 21 — Somente detecção e reconhecimento são carregados

```gherkin
Dado o serviço iniciando
Quando FaceAnalysis é instanciado
Então allowed_modules contém exatamente "detection" e "recognition"
E nenhum módulo de gênero ou idade é carregado
E nenhum módulo de landmarks 2D ou 3D é carregado
E remover a restrição de allowed_modules faz este cenário falhar
```

### Cenário 14 — `purpose` fora do domínio

```gherkin
Dado um job cujo purpose é "sentiment_only"
Quando o worker o consome
Então o payload é rejeitado na validação do schema
E nenhuma chave de resultado é escrita
```

### Cenário 15 — Variável de ambiente ausente derruba a inicialização

```gherkin
Dado um ambiente sem a variável REDIS_URL
Quando o processo inicia
Então ele encerra com código diferente de zero
E a mensagem de erro nomeia REDIS_URL e o formato esperado
E nenhuma conexão com Redis é tentada
```

### Cenário 16 — Sem superfície HTTP de inferência

```gherkin
Dado o serviço em execução
Quando uma requisição POST é enviada a /process-image
Então a resposta é 404
E a porta do ai-service não está publicada no host pelo compose
```

### Cenário 17 — Concorrência real

```gherkin
Dado quatro jobs válidos enfileirados no mesmo instante
Quando o worker os consome
Então os quatro são processados simultaneamente
E o tempo total é menor que a soma dos tempos individuais
E os quatro resultados são publicados dentro do orçamento de 3000 ms
```

### Cenário 18 — Job consumido antes da carga dos modelos

```gherkin
Dado que o serviço iniciou mas o modelo de anti-spoofing ainda carrega
Quando um job é consumido
Então error é "MODEL_NOT_READY"
E /health responde status "degraded"
```

### Cenário 19 — Detecção usa o tamanho configurado

```gherkin
Dado que AI_DET_SIZE está definido como 320
Quando os modelos carregam na inicialização
Então o detector é preparado com det_size (320, 320)
E CUDAExecutionProvider não consta na lista de providers
```

---

## Fora de Escopo

- **Agregação do dado afetivo** por turma, horário e professor (RF-17, RF-18). Pertence ao `api-core` e
  depende de Q-03 e Q-06 fecharem. Esta spec produz o dado por captura; nada além disso.
- **Entrega ao sistema de RH** (RF-19). Bloqueada por Q-02.
- **Correspondência 1:N e limiar de similaridade.** O `ai-service` devolve o vetor; a busca em pgvector e
  os limiares `MATCH`/`POSSÍVEL`/`SEM_MATCH` são do `api-core` e já estão em `docs/face/README.md`.
- **Múltiplos rostos por quadro.** A câmera fica na porta e os alunos passam um por vez. Reconhecimento
  simultâneo em quadro de sala exigiria outro produto e outro contrato.
- **Aceleração por GPU.** O alvo é CPU. `CUDAExecutionProvider` sai da lista de providers, já que
  `onnxruntime` (CPU) é a dependência instalada e anunciar um provider ausente só produz aviso.
- **Calibração final dos limiares** contra a turma real. A Task 13 (issue #72) estabelece o procedimento e um primeiro
  conjunto de valores; a calibração definitiva depende da câmera instalada e vira nota no artigo.
- **Retenção e prazo de descarte do dado afetivo** (RNF-03). Decisão de conformidade, não de pipeline.
- **Aprovação ética da pesquisa** (Q-01). Bloqueia coleta com aluno real, não o desenvolvimento.

## Quebra em Tasks

| # | Issue | Título | Escopo | Critério de aceite | Depende de |
| --- | --- | --- | --- | --- | --- |
| 0 | #59 | Restrict InsightFace to the modules actually consumed | `services/face_service.py` | Cenário 21; `allowed_modules` fixo em `detection` e `recognition`; nenhuma inferência de gênero ou idade | — |
| 1 | #60 | Fix hanging worker tests and green the ai-service gates | `tests/test_redis_worker.py`, `pyproject.toml`, `pytest.ini` | A suíte completa termina; `pytest-timeout` com teto de `30 s` por teste; `ruff check .` sai com `0` erros | — |
| 2 | #61 | Cover the face pipeline with executable tests | `tests/test_face_service.py` | Cenários 3, 5, 6, 9, 10, 11 verificados com detector falso; remover qualquer guard da Regra 1 quebra ao menos um teste | 1 |
| 3 | #62 | Make every environment variable required and fail-fast | `config.py`, `.env.example` | Cenário 15; nenhum `Field(default=...)` resta em `config.py` | 1 |
| 4 | #63 | Remove the HTTP inference surface | `main.py`, `schemas/http_schemas.py`, `infra/docker-compose.yml` | Cenário 16; `/health` permanece; `ai-service` sem porta publicada | 3 |
| 5 | #64 | Add purpose to the job contract | `schemas/job_schemas.py`, `apps/api-core/src/adapters/queue/ai-job.queue.ts`, `IAIQueueAdapter.ts` | Cenário 14; os três use-cases do `api-core` enviam o `purpose` correto | 2 |
| 6 | #65 | Add the frontality gate | `validators/frontality.py`, `services/face_service.py` | Cenário 3; `frontality_score` publicado no `AIResult` | 2 |
| 7 | #66 | Add MiniFASNetV2 liveness detection | `services/liveness_service.py`, `Dockerfile`, `main.py` | Cenários 4 e 18; modelo baixado em tempo de build; `liveness_score` publicado; `/health` responde `degraded` até os três modelos carregarem | 6 |
| 8 | #67 | Add facial expression inference | `services/emotion_service.py`, `schemas/job_schemas.py`, `Dockerfile` | Cenários 1, 2, 7, 8; mapeamento de rótulos da Regra 6 verificado item a item | 5, 7 |
| 9 | #68 | Split the time budget, shrink det_size and cancel abandoned work | `config.py`, `services/face_service.py`, `workers/redis_worker.py` | Cenários 12 e 19; orçamento do `ai-service` menor que o do `api-core`; inferência abandonada cessa em `100 ms` | 7 |
| 10 | #69 | Process jobs concurrently and answer malformed payloads | `workers/redis_worker.py`, `apps/api-core/src/adapters/queue/ai-job.queue.ts` | Cenários 13, 17, 20; quatro jobs simultâneos dentro do orçamento; `INVALID_JOB_PAYLOAD` não abre o circuito | 9 |
| 11 | #70 | Map the new error codes in api-core | `apps/api-core/src/adapters/http/routes/face.routes.ts`, `attendance.routes.ts` | Tabela de Erros verificada código a código, com as mensagens literais | 5, 6, 7 |
| 12 | #71 | Persist sentiment from the attendance flow | `RecordAttendanceUseCase.ts`, `attendance.repository.ts` | `sentiment_label` e `sentiment_score` gravados em `attendance_records`; `null` quando o `AIResult` traz `null` | 8, 11 |
| 13 | #72 | Calibrate thresholds against real capture | `docs/specs/ai-service-pipeline-inferencia.md`, `.env.example` | Procedimento documentado; `AI_DET_SIZE`, `AI_MAX_YAW_RATIO`, `AI_MAX_ROLL_DEG`, `AI_MIN_LIVENESS` e `AI_MIN_EMOTION_CONFIDENCE` com valor medido e justificado | 10, 12 |
| 14 | #73 | Make packages/types the single source of the queue contract | `packages/types`, `schemas/job_schemas.py`, `apps/api-core/src/adapters/queue/ai-job.queue.ts` | Cenário 22; campo removido da definição única quebra o gate dos dois lados | 5, 8 |
