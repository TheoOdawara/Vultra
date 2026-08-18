# 0002. Pipeline de inferência do ai-service: modelos, superfície e contrato

- Status: proposto
- Data: 2026-08-16
- Emenda: ADR-005 (Pipeline de Reconhecimento Facial — PoC e Produção)
- Especificação relacionada: `docs/specs/ai-service-pipeline-inferencia.md`

## Contexto

O `ai-service` entrega hoje apenas vetor, qualidade e tempo. A análise afetiva — a contribuição de
pesquisa que sustenta o artigo de dezembro de 2026 — não existe em nenhuma camada (R-01 em
`docs/requirements.md`). As colunas `sentiment_label` e `sentiment_score` existem em
`attendance_records` desde a migration `0007` e nunca recebem valor; o `api-core` e o `frontend-rh` leem e
exibem um dado que nunca é produzido.

Quatro forças pesam sobre a decisão:

**Segurança.** `main.py` expõe `POST /process-image` sem autenticação, sem tenant e sem rate limiting, e
`infra/docker-compose.yml` publica a porta `8000` no host. Qualquer processo na rede envia um quadro e
recebe um vetor biométrico de 512 dimensões, contornando inteiramente os controles que o `api-core`
aplica em `/v1/face/*`. RNF-07 exige que nenhum endpoint que toque biometria seja alcançável sem
autenticação **em nenhum ambiente**, enquanto o ADR-005 autoriza esse caminho HTTP para PoC. Os dois
documentos não podem estar certos ao mesmo tempo.

**Fraude.** O produto substitui a chamada manual justamente porque ela era falsificável. Um pipeline que
aceita a foto do colega no celular reintroduz a fraude que o sistema existe para eliminar. Geometria de
landmarks não resolve isso: uma foto impressa produz o mesmo triângulo olhos-nariz-boca que o rosto real,
e a distinção é de textura.

**Custo de dependência.** O serviço já carrega `onnxruntime` para o InsightFace. Adicionar capacidade por
modelos ONNX reaproveita esse runtime; adicionar por biblioteca (DeepFace, que o ADR-005 e os comentários
do schema mencionam) arrastaria TensorFlow e um segundo runtime de inferência para dentro da imagem.

**Reprodutibilidade.** O artigo precisa nomear e versionar cada modelo. Um pacote em desenvolvimento
ativo muda debaixo do experimento entre a coleta e a submissão.

## Decisão

**1. A fila Redis é o único contrato de inferência.** `POST /process-image` é removido, os schemas HTTP de
inferência são removidos, e o `ai-service` deixa de publicar porta no host. Permanece apenas `GET /health`,
alcançável somente pela rede interna do compose. Isto **emenda o ADR-005**: o modo "PoC local por HTTP
síncrono" deixa de existir, e a validação com webcam passa pelo `api-core` como qualquer outra captura.

**2. Expressão facial por `facial_expression_recognition_mobilefacenet_2022july.onnx`** (OpenCV Zoo,
Apache-2.0). Entrada `[1, 3, 112, 112]` float32, saída `[1, 7]` softmax, `4.6 MB`, `6.84 ms` por
inferência em CPU Apple Silicon com `onnxruntime` 1.28.0. Os sete rótulos do modelo mapeiam um a um para o
domínio já presente em `attendance_records.sentiment_label`.

Fica a variante **fp32**, não a int8: medida no alvo, a int8 leva `13.92 ms` — `2×` mais lenta, apesar de
`3.5×` menor. Quantização só compensa onde existe kernel otimizado.

**3. Anti-spoofing por `MiniFASNetV2` em ONNX** (Silent-Face-Anti-Spoofing, Apache-2.0). Entrada BGR
`80×80` com fator de recorte `2.7`, saída softmax `[live, print_attack, replay_attack]`, cerca de `0.43M`
parâmetros. Reprovado, o job devolve `SPOOF_DETECTED` sem embedding, nos três fluxos — cadastrar uma foto
contamina toda captura futura daquele aluno.

**4. Gate de frontalidade sobre os cinco keypoints que a detecção já devolve.** Nenhum modelo adicional.
Duas métricas geométricas (`yaw_ratio` e `roll_deg`) reprovam com `NOT_FRONTAL` antes do custo do
embedding e do anti-spoofing.

**5. O job passa a carregar `purpose`** (`enroll`, `verify`, `attendance`). Anti-spoofing roda nos três;
expressão facial roda apenas em `attendance`. Inferir afeto no momento do cadastro produziria dado colhido
fora de aula, que é ruído na série que o artigo mede.

**6. A inferência afetiva nunca reprova o job.** Falha de modelo, exceção ou confiança abaixo de `0.40`
produzem `sentiment_label = null` com a presença registrada normalmente. A presença é o produto direto; o
afeto é subproduto e degrada sozinho.

**7. O orçamento de tempo é decomposto.** `3000 ms` de ponta a ponta no `api-core`, `2000 ms` de
processamento no `ai-service`. Hoje ambos valem `3000 ms`, o que permite ao `ai-service` publicar um
resultado que o `api-core` já descartou.

**8. Toda variável de ambiente é obrigatória e validada na inicialização**, sem valor padrão no ponto de
leitura, conforme RNF-06 e `docs/decisions/0001-baseline-de-seguranca.md`.

## Consequências

**Fica mais fácil**

- A superfície biométrica passa a ter um único ponto de entrada autenticado. Não há mais um caminho que
  contorne RBAC, rate limiting e auditoria.
- O artigo pode nomear três modelos com versão fixa e licença Apache-2.0, e reportar a taxa de abstenção
  como número honesto em vez de rótulo chutado.
- A imagem Docker não ganha um segundo runtime de inferência: as três capacidades compartilham o
  `onnxruntime` já instalado.
- O custo total do pipeline cresce cerca de `15 ms` — desprezível diante dos `200–400 ms` da detecção.

**Fica mais difícil**

- O `api-core` e o `ai-service` mudam de contrato ao mesmo tempo (`purpose` na entrada, quatro campos
  novos na saída). Os dois lados precisam entrar na mesma janela.
- A validação com webcam local perde o atalho HTTP e passa a exigir o `api-core` de pé com Redis.
- Três modelos carregam na inicialização em vez de um, alongando o tempo até `/health` responder `ok`. O
  `start_period` do healthcheck acompanha.
- `SPOOF_DETECTED` cria uma classe nova de falso negativo: uma pessoa real recusada por iluminação ruim.
  O limiar de `0.70` é inicial e depende de calibração contra a câmera instalada.

**O que aceitamos**

- **A acurácia publicada não se sustenta em sala.** O modelo de expressão reporta `88.27%` em RAF-DB, um
  dataset de imagens bem iluminadas e majoritariamente frontais. Uma ESP32-CAM na porta, com iluminação
  lateral e rosto pequeno no quadro, renderá bem menos. O número real da instalação é resultado
  experimental do artigo, não uma promessa desta decisão.
- **Anti-spoofing de modelo único é contornável.** MiniFASNetV2 detecta foto impressa e tela; não detecta
  máscara de silicone nem deepfake em vídeo de alta qualidade. Para chamada de aula, em uma Iniciação
  Científica, é a proporção certa entre custo e ameaça — e é o mesmo patamar que produtos comerciais de
  controle de acesso de baixo custo adotam. Trade-off documentado, não `security-debt`.
- **Um rosto por quadro.** A câmera fica na porta e os alunos passam um por vez. Reconhecimento
  simultâneo em quadro de sala é outro produto.

## Alternativas consideradas

**DeepFace para a análise afetiva** · Rejeitada. É o que o ADR-005 e o comentário da migration `0007` já
assumiam, o que a tornava o caminho de menor atrito documental. Mas arrasta TensorFlow (mais de `500 MB`)
para uma imagem que já tem um runtime de inferência, e a escolha do modelo interno fica atrás de uma
camada de abstração que dificulta versionar exatamente o que rodou no experimento.

**EmotiEffLib (sb-ai-lab)** · Rejeitada, com ressalva. Tecnicamente é a opção mais forte para publicação:
`66.51%` em AffectNet 7-classes — dataset bem mais difícil que RAF-DB — e vitórias em desafios ABAW dão
respaldo acadêmico. Perdeu por ser uma biblioteca em desenvolvimento ativo, com dependência de `timm` e
PyTorch, contra um arquivo ONNX congelado desde 2022. O critério declarado foi estabilidade. Se a
calibração da Task 13 mostrar que o modelo escolhido não separa as classes em captura real, esta é a
primeira alternativa a testar.

**Anti-spoofing por geometria do triângulo facial** · Rejeitada por não funcionar. Foi a hipótese inicial
de trabalho. Uma foto impressa produz exatamente o mesmo triângulo olhos-nariz-boca que o rosto real: a
métrica é invariante ao ataque que deveria detectar. Teria passado em revisão de código sem pegar nada.

**Manter `/process-image` com autenticação de serviço** · Rejeitada. Preservaria o atalho de PoC do
ADR-005 ao custo de dois caminhos de inferência que divergem com o tempo, dois lugares para aplicar rate
limiting e dois lugares para errar. O caminho de fila é o de produção; um segundo caminho que só existe em
desenvolvimento é exatamente o que o próprio ADR-005 listou como risco.

**Registrar `/process-image` apenas quando `DEBUG=true`** · Rejeitada. Continua contrariando o "em nenhum
ambiente" de RNF-07, e faz a superfície de segurança depender de uma variável de ambiente — o tipo de
configuração que vaza para produção.

**Sinalizar suspeita de spoof em vez de bloquear** · Rejeitada. Transfere para o professor a revisão de
cada captura suspeita, durante a aula, que é justamente o trabalho manual que o produto elimina. Um guard
que não bloqueia não é um guard.

**Manter o orçamento único de `3000 ms`** · Rejeitada. Mantém o desalinhamento em que o `ai-service`
conclui dentro do próprio prazo depois de o `api-core` já ter desistido, gastando CPU para produzir
resultado que ninguém lê.
