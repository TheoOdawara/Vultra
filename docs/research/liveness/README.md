# Levantamento de modelos de vivacidade

> **Issue:** #183
> **Spec:** [SPEC-006](../../specs/levantamento-de-modelos-de-vivacidade.md)
> **Medido em:** 2026-10-09, por Theo Odawara
> **Decide:** a linha `Vivacidade` do [ADR 0006](../../decisions/0006-inferencia-no-processo-do-servico.md)

O ADR 0006 escolheu o MiniFASNetV2 sem comparar alternativa, e o repositório oficial não publica ONNX.
Este documento compara três candidatos pelos mesmos campos, mede a latência de cada um no `onnxruntime`
do ADR 0005 e aplica a regra de decisão que a spec fixou antes da medição. Ele não mede acurácia: a taxa
de bloqueio na ESP32-CAM é medição do artigo, e a
[OQ-07](../../requirements/open-questions.md#oq-07) continua aberta.

## Candidatos

Fontes, com o commit de cada uma:

- **Oficial:** [`minivision-ai/Silent-Face-Anti-Spoofing`](https://github.com/minivision-ai/Silent-Face-Anti-Spoofing/tree/b6d5f04ad78778917853b25c778acef6d5626d15),
  commit `b6d5f04ad78778917853b25c778acef6d5626d15`.
- **Terceiro:** [`facenox/face-antispoof-onnx`](https://github.com/facenox/face-antispoof-onnx/tree/b3beb74c546b0bbf98bfe361c7ef0a94832509eb),
  release `v1.0.0`, commit `b3beb74c546b0bbf98bfe361c7ef0a94832509eb`. O endereço
  `suriAI/face-antispoof-onnx` citado na issue redireciona para este.
- **Dataset do terceiro:** [`ZhangYuanhan-AI/CelebA-Spoof`](https://github.com/ZhangYuanhan-AI/CelebA-Spoof/tree/566342dd0f1fbb07733df8b7e742b90725fb2c4d),
  commit `566342dd0f1fbb07733df8b7e742b90725fb2c4d`.

| Campo | A · V2 oficial | B · par oficial V2 + V1SE | C · `best_model.onnx` de terceiro |
| --- | --- | --- | --- |
| Arquitetura | MiniFASNetV2 (`src/model_lib/MiniFASNet.py`) | MiniFASNetV2 e MiniFASNetV1SE, com as saídas somadas depois do softmax (`test.py`) | MiniFASNet V2 SE (`docs/ARCHITECTURE.md`) |
| Entrada | `1×3×80×80`, BGR, `float32` de 0 a 255, sem normalização (`src/data_io/functional.py`, `to_tensor`) | a mesma, uma por modelo | `N×3×128×128`, RGB, `float32` de 0 a 1 (`src/inference/preprocess.py`, `demo.py`) |
| Fator de recorte do rosto | 2,7 (nome do peso, lido por `parse_model_name`) | 2,7 no V2 e 4,0 no V1SE | 1,5, com borda refletida (`src/inference/preprocess.py`, `demo.py`) |
| Classes de saída e ordem | 3 classes; `1` é rosto real (`test.py`). O significado de `0` e de `2` é `não publicado` | as mesmas 3 classes | 2 classes: `0` real, `1` spoof (`src/inference/inference.py`) |
| Licença do código | Apache-2.0 (`LICENSE`) | Apache-2.0 | Apache-2.0 (`LICENSE`) |
| Licença do peso | Apache-2.0: o peso está no repositório, sem termo próprio | Apache-2.0 | Apache-2.0: o peso está na release, sem termo próprio |
| Dataset de treino e licença | `não publicado` | `não publicado` | CelebA-Spoof (corpo da release). Só pesquisa não comercial (`README.md` do dataset, `Dataset Agreement`) |
| Origem do ONNX | convertido por nós | convertido por nós | convertido por terceiro (`scripts/export_onnx.py`, opset 13) |
| Resultado publicado | `não publicado` para o V2 sozinho | TPR de 97,8% com FPR de 1e-5, no modelo do APK; dataset `não publicado` (`README_EN.md`) | acurácia de 98,20% e ROC-AUC de 0,9984 em 71 338 amostras do CelebA-Spoof (`README.md`, `metrics.json`) |
| Executa no `onnxruntime` 1.30.0 | sim | sim | sim |
| Latência em CPU, p50 e p95 | 1,543 ms e 2,631 ms | 4,214 ms e 7,466 ms | 4,343 ms e 7,281 ms |

Duas ressalvas que as fontes declaram:

- O repositório oficial avisa que a robustez depende do modelo da câmera e da cena (`README_EN.md`,
  `Before test you must know`).
- O repositório de terceiro declara que o modelo não foi treinado com máscara 3D e que precisa de rosto
  de pelo menos 64×64 pixels na origem (`docs/LIMITATIONS.md`).

## Conversão

Os dois `.pth` oficiais foram convertidos por
[`convert_minifasnet.py`](convert_minifasnet.py),
que carrega o peso com `weights_only=True`, exporta com `torch.onnx.export` num arquivo único e compara a
saída do ONNX com a do PyTorch sobre o mesmo tensor de semente `0`. Antes de gravar, ele remove os
metadados dos nós: o exportador grava neles o caminho absoluto do clone, e com isso o SHA-256 mudava
conforme a pasta em que a conversão rodava.

```
uv run --no-project --python 3.13 \
  --index https://download.pytorch.org/whl/cpu --index-strategy unsafe-best-match \
  --with torch==2.14.1 --with onnx==1.23.2 --with onnxscript==0.7.2 \
  --with onnxruntime==1.30.0 --with numpy==2.5.3 \
  docs/research/liveness/convert_minifasnet.py \
  --repo <clone> --weights <clone>/resources/anti_spoof_models/<peso>.pth --output <saída>.onnx
```

| Ferramenta | Versão |
| --- | --- |
| Python | 3.13.15 |
| `torch` | 2.14.1 |
| `onnx` | 1.23.2 |
| `onnxscript` | 0.7.2 |
| `onnxruntime` | 1.30.0 |
| `numpy` | 2.5.3 |

| Peso de origem | SHA-256 do `.pth` | Opset | SHA-256 do `.onnx` | Diferença máxima |
| --- | --- | --- | --- | --- |
| `2.7_80x80_MiniFASNetV2.pth` | `a5eb02e1843f19b5386b953cc4c9f011c3f985d0ee2bb9819eea9a142099bec0` | 20 | `f89cdeaa53287ac3ca18dbc0f4903498898d8db8f334afd7bc9e9c1fe7c6c64d` | 4,768e-07 |
| `4_0_0_80x80_MiniFASNetV1SE.pth` | `84ee1d37d96894d5e82de5a57df044ef80a58be2b218b5ed7cdfd875ec2f5990` | 20 | `ab4c068865ebcf83b8ef86b022cc0ccbe58d0c584091a0a8005af7b716d90afa` | 2,027e-06 |

As duas ficam abaixo da tolerância de `1e-4`. Os dois ONNX desta tabela são os da reconversão de
2026-10-09 em Linux, com o `torch` do índice de CPU, e são os destinados à Release `models-v1` deste
repositório, ainda não publicada. A conversão foi repetida a partir de outra pasta e gerou os mesmos dois SHA-256. A igualdade
do SHA-256 entre sistemas operacionais não foi medida: o arquivo de referência é o da Release.

A primeira conversão, feita no Windows antes de o script remover os metadados, gerou
`c9893806bb17f10c4397510b86d9b5b7a17b67e1de25993d9c8174c8aaf1ad0b` e
`2897a623f7e9508b317655f28258435ec56f592daeadcc5d1a0360231f0d58a2`. A latência abaixo foi medida nesses
dois arquivos; os metadados não entram na execução.

Os `.pth` vêm de `resources/anti_spoof_models/` no commit `b6d5f04`. No Windows o clone completo falha,
porque o repositório tem uma pasta com espaço no fim do nome; o clone usado foi esparso, só com `src/` e
`resources/anti_spoof_models/`.

Os dois arquivos de terceiro vêm da release, com o SHA-256 conferido contra o `digest` do asset:

| Arquivo | URL | SHA-256 |
| --- | --- | --- |
| `best_model.onnx` | `https://github.com/facenox/face-antispoof-onnx/releases/download/v1.0.0/best_model.onnx` | `af2381b88f38769222ed93379e12444e2a50814575de1c46170de570c55a42b6` |
| `best_model_quantized.onnx` | `https://github.com/facenox/face-antispoof-onnx/releases/download/v1.0.0/best_model_quantized.onnx` | `fde20585635cae62ed1d41796f76b6f8bc4b92cd91ec1cf0f1bc6485d2d587a9` |

Nenhum `.pth` nem `.onnx` está no repositório.

## Latência

Medida por
[`measure_latency.py`](measure_latency.py):
`CPUExecutionProvider`, uma thread, tensor `float32` de semente `0` na forma que a sessão declara, 50
execuções de aquecimento e 1000 medidas.

```
uv run --no-project --python 3.13 --with onnxruntime==1.30.0 --with numpy==2.5.3 \
  docs/research/liveness/measure_latency.py --model <arquivo>.onnx [--model <arquivo>.onnx]
```

- **Processador:** AMD Ryzen 7 5700X 8-Core
- **Sistema operacional:** Windows 11 Home 10.0.26300

| Modelo | p50 | p95 | p50 na repetição | p95 na repetição |
| --- | --- | --- | --- | --- |
| A · V2 oficial | 1,543 ms | 2,631 ms | 1,812 ms | 3,849 ms |
| B · par oficial, os dois em sequência | 4,214 ms | 7,466 ms | 3,567 ms | 6,744 ms |
| C · `best_model.onnx` | 4,343 ms | 7,281 ms | 4,211 ms | 7,060 ms |
| `best_model_quantized.onnx`, só latência | 7,175 ms | 11,249 ms | 8,523 ms | 12,874 ms |

A primeira passada é a medida. A repetição, feita logo em seguida na mesma máquina, mostra o tamanho da
variação: B e C trocam de lugar, e A fica em primeiro nas duas. O arquivo quantizado é mais lento que o
FP32 neste processador.

O número serve para comparar os candidatos entre si. A latência do ambiente de nuvem e o orçamento da
[OQ-03](../../requirements/open-questions.md#oq-03) são do épico #179.

## Regra de decisão

A regra 5 da spec, na ordem em que foi escrita.

**Eliminação.** Nenhum candidato foi eliminado.

| Critério | A | B | C |
| --- | --- | --- | --- |
| Licença proíbe pesquisa não comercial | não: Apache-2.0; dataset `não publicado`, que não elimina | não: idem | não: Apache-2.0; o CelebA-Spoof permite pesquisa não comercial |
| Não executa no `onnxruntime` 1.30.0 | executa | executa | executa |
| Origem do ONNX não se reproduz | reproduz: diferença de 4,768e-07 | reproduz: 4,768e-07 e 2,027e-06 | reproduz: SHA-256 no `digest` do asset da release |

**Ordenação.**

1. *Distingue foto impressa de tela.* Nenhum vence. A e B têm três classes, mas só a classe `1` tem
   significado publicado. C tem duas classes, real e spoof.
2. *Menor p95.* A, com 2,631 ms; depois C, com 7,281 ms; depois B, com 7,466 ms.

## Recomendação

**O MiniFASNetV2 oficial sozinho, convertido por nós** (`2.7_80x80_MiniFASNetV2.pth`, ONNX de SHA-256
`f89cdeaa53287ac3ca18dbc0f4903498898d8db8f334afd7bc9e9c1fe7c6c64d`). O ADR 0006 é **confirmado**: a
linha `Vivacidade` fica como está e ganha a origem do ONNX, o SHA-256 e a latência.

O que a regra não pesa e quem aceita precisa saber:

- O repositório oficial só publica resultado para a fusão dos dois modelos. Para o V2 sozinho não há
  número publicado; a taxa de bloqueio dele sai da medição do artigo.
- O candidato C é o único com métrica e dataset publicados, e o dataset restringe o uso a pesquisa não
  comercial, a mesma restrição dos pesos do `buffalo_l`.

A decisão de aceitar é de Theo e é registrada no ADR 0006 com a data.
