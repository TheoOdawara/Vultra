# 0006. Inferência no processo do serviço, com a fila como saída

- Status: accepted
- Date: 2026-10-06
- Substitui: [ADR-003 de backend](../backend/adrs/ADR-003-circuit-breaker-redis.md), [ADR-005 de backend](../backend/adrs/ADR-005-face-recognition-pipeline.md)
- Emenda: [0002](0002-pipeline-de-inferencia-do-ai-service.md) — os modelos ficam; o contrato de fila sai
- Requisitos: BR-01, FR-BIO-02, FR-BIO-03, FR-AFF-01, NFR-PERF-01, NFR-REL-01

## Contexto

Hoje o quadro trafega em base64 por uma fila Redis, e a API espera o resultado consultando uma chave a
cada 50 ms. Dois problemas saem daí:

- **O quadro pode ir para o disco.** O Redis do compose tem volume em `/data` e o snapshot padrão
  ligado, então um quadro na fila pode ser gravado em um snapshot. Isso viola a BR-01.
- **O polling entra na latência que o artigo mede** (NFR-PERF-01), sem pertencer ao pipeline.

A câmera fica na porta e as pessoas passam uma a uma (BR-02): não há rajada a amortecer, e uma captura
atrasada além do orçamento não serve para nada.

## Decisão

**O pipeline roda em um pool de processos dentro do serviço** ([0005](0005-backend-unico-em-python.md)).
O serviço entrega o quadro ao pool e aguarda o resultado; a fila é a do próprio pool, em memória e
limitada. O Redis deixa de carregar quadros e fica para a cota e para o canal de comandos das câmeras.

**O pipeline é um pacote com uma única função de entrada**, que recebe o quadro e a finalidade e devolve
o resultado. Nada fora dele sabe como a inferência é executada.

**A decisão final entre pool e fila fica para a medição de [OQ-03](../requirements/open-questions.md#oq-03).**
O critério de troca é a medição mostrar disputa de CPU entre a API e a inferência, ou a necessidade de
escalar a inferência em outra máquina. Trocar muda o ponto de chamada do pacote, e só ele.

**Modelos**, validados nas fontes em 2026-10-06 e sujeitos à medição em dataset público
([OQ-07](../requirements/open-questions.md#oq-07)):

| Etapa | Modelo | Licença |
| --- | --- | --- |
| Detecção e vetor de 512 dimensões | InsightFace `buffalo_l`, só os módulos `detection` e `recognition` | Código MIT; pesos apenas para pesquisa não comercial |
| Vivacidade | MiniFASNetV2 e MiniFASNetV1SE, com as saídas somadas. Emendado em 2026-10-09 por Theo Odawara | Apache-2.0 |
| Emoção | FER MobileFaceNet do OpenCV Zoo, 7 classes | Apache-2.0 |

`insightface` 2.1 com `onnxruntime` 1.30.0 e `numpy` 2.5.3 foi executado em Python 3.13: carregou o
`buffalo_l` com os dois módulos e gerou vetor `float32` de 512 dimensões.

## Levantamento de modelos de vivacidade

O [levantamento](../research/liveness/README.md) de 2026-10-09 comparou três candidatos: o MiniFASNetV2
oficial sozinho, o par oficial MiniFASNetV2 e MiniFASNetV1SE, e um ONNX de terceiro. Nenhum foi eliminado.
A regra recomendou o V2 sozinho, pelo menor p95.

**Theo Odawara recusou a recomendação em 2026-10-09 e escolheu o par oficial.** É o único uso para o qual
o repositório oficial publica resultado, e a diferença de cerca de 5 ms não pesa no orçamento da captura.

- **Origem do ONNX:** convertido por nós a partir dos `.pth` de
  `minivision-ai/Silent-Face-Anti-Spoofing`, no commit `b6d5f04ad78778917853b25c778acef6d5626d15`. O
  repositório oficial não publica ONNX. Os dois arquivos são os destinados à Release `models-v1`
  deste repositório.
- **Latência do par em CPU**, uma thread, `onnxruntime` 1.30.0, AMD Ryzen 7 5700X: p50 de 4,214 ms e p95
  de 7,466 ms.

| Arquivo | SHA-256 do ONNX |
| --- | --- |
| `2.7_80x80_MiniFASNetV2.onnx` | `f89cdeaa53287ac3ca18dbc0f4903498898d8db8f334afd7bc9e9c1fe7c6c64d` |
| `4_0_0_80x80_MiniFASNetV1SE.onnx` | `ab4c068865ebcf83b8ef86b022cc0ccbe58d0c584091a0a8005af7b716d90afa` |

## Consequências

- O quadro existe apenas na memória do serviço e dos processos do pool. A BR-01 deixa de depender da
  configuração de persistência do Redis.
- A latência medida é a do pipeline, sem intervalo de polling.
- Se um processo do pool cai, o serviço responde a captura com erro tratado e continua atendendo as
  demais operações (NFR-REL-01).
- **Não se escala só a inferência.** Mais capacidade de inferência é mais uma réplica do serviço inteiro.
- **API e modelos disputam a CPU e a memória do mesmo contêiner**, e cada processo do pool carrega os
  modelos.
- **Uma captura em processamento se perde se o serviço reinicia.** A câmera captura de novo.
- **Trocar um modelo reinicia a API.**
- **Os pesos do `buffalo_l` impedem uso comercial.** Servem à Iniciação Científica e ao artigo; vender o
  Vultra exige licenciar os pesos ou trocar o modelo de vetor.
- **A robustez do par MiniFASNet depende do modelo da câmera e da cena**, segundo o próprio repositório.
  Na ESP32-CAM a taxa de bloqueio é medição obrigatória e entra nas limitações do artigo.

## Alternativas consideradas

| Alternativa | Por que foi rejeitada |
| --- | --- |
| Manter a fila Redis com espera síncrona | Exige Redis sem persistência para cumprir a BR-01 e mantém o polling na medição. Paga-se quando há várias máquinas de inferência ou trabalho que pode esperar, e nenhum dos dois existe hoje. Fica como saída. |
| Serviço de inferência separado, chamado por HTTP interno | Isola recursos e permite escalar a inferência, ao custo de um segundo serviço e de um contrato entre os dois. Sem medição que o justifique. |
| Inferência na mesma thread da API | Uma falha nativa do runtime dos modelos derrubaria a API, contra o NFR-REL-01. |
