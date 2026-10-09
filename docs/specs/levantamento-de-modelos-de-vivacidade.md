# SPEC-006 — Levantar e comparar modelos de vivacidade com fonte ONNX verificada

> **Status:** fechada
> **Perfil:** API
> **Módulo:** `docs/research/liveness`
> **Epic:** — (issue avulsa #183, sem sub-issues)
> **Requisitos:** nenhum é coberto. O levantamento confirma ou emenda o [ADR 0006](../decisions/0006-inferencia-no-processo-do-servico.md), que sustenta FR-BIO-03
> **Sprint:** 1

O ADR 0006 escolhe o MiniFASNetV2 para a vivacidade sem alternativa comparada, e o repositório oficial
publica só o peso `.pth`. Esta spec define o levantamento: quais candidatos entram, o que se registra de
cada um, como o ONNX é obtido e medido, e qual regra produz a recomendação. O resultado decide o modelo
de vivacidade do épico #174.

## Premissas confirmadas

Confirmadas por Theo em 2026-10-08.

1. A lista de candidatos é fechada em três: o MiniFASNetV2 oficial convertido por nós, o par oficial
   MiniFASNetV2 + MiniFASNetV1SE convertido por nós, e o `best_model.onnx` FP32 da release v1.0.0 de
   `face-antispoof-onnx`. O `best_model_quantized.onnx` da mesma release entra só como linha de latência.
2. A conversão do `.pth` oficial usa `torch` como ferramenta descartável, por `uv run --with`. `torch`
   não entra em nenhum `pyproject.toml` nem na tabela do ADR 0005.
3. O levantamento não mede acurácia. Registra o resultado publicado e o dataset dele. A taxa de bloqueio
   na ESP32-CAM continua sendo medição do artigo, e a
   [OQ-07](../requirements/open-questions.md#oq-07) continua aberta.
4. A latência é medida na máquina de Theo, com `onnxruntime` 1.30.0, Python 3.13 e
   `CPUExecutionProvider`, sobre tensor sintético.
5. Os scripts de conversão e de latência são versionados em `docs/research/liveness/`, ao lado do
   documento. Nenhum `.onnx` nem `.pth` é versionado: o documento registra a URL de origem e o SHA-256
   de cada arquivo.
6. A regra de decisão é eliminatória e depois ordenada, escrita antes de qualquer medição. Theo aceita ou
   recusa a recomendação.
7. Uma issue, uma branch `chore/183-liveness-model-survey`, duas entregas. Onde o pipeline busca o peso
   escolhido é da spec do épico #174.

## Valores confirmados

Confirmados por Theo em 2026-10-09.

| Valor | Decisão |
| --- | --- |
| Tolerância da conversão | diferença absoluta máxima de `1e-4` entre a saída do ONNX e a do PyTorch |
| Threads na medição | uma (`intra_op_num_threads=1`) |
| Amostra da medição | 50 execuções de aquecimento e 1000 medidas, com p50 e p95 |
| ONNX de terceiro | só é reproduzível com SHA-256 publicado na release |
| Licença do dataset de treino | elimina o candidato quando proíbe pesquisa não comercial |
| Nenhum candidato sobra | o ADR 0006 não muda e a escolha volta a Theo |
| Pasta e arquivos | `docs/research/liveness/`, com `README.md`, `convert_minifasnet.py` e `measure_latency.py` |
| Gates dos scripts | `ruff` 0.16.10; sem `mypy` |

## Fontes

Consultadas em 2026-10-08 e 2026-10-09, pela API do GitHub e pelo PyPI.

| Fonte | Fato |
| --- | --- |
| `minivision-ai/Silent-Face-Anti-Spoofing` | licença Apache-2.0; commit `b6d5f04ad78778917853b25c778acef6d5626d15` na `master`; sem release; pesos em `resources/anti_spoof_models/`: `2.7_80x80_MiniFASNetV2.pth` e `4_0_0_80x80_MiniFASNetV1SE.pth`; nenhum `.onnx` |
| `suriAI/face-antispoof-onnx` | o endereço redireciona para `facenox/face-antispoof-onnx`; licença Apache-2.0; release `v1.0.0` |
| `best_model.onnx` da v1.0.0 | 1 912 594 bytes, SHA-256 `af2381b88f38769222ed93379e12444e2a50814575de1c46170de570c55a42b6` |
| `best_model_quantized.onnx` da v1.0.0 | 626 197 bytes, SHA-256 `fde20585635cae62ed1d41796f76b6f8bc4b92cd91ec1cf0f1bc6485d2d587a9` |

## Versões

| Dependência | Versão | Origem |
| --- | --- | --- |
| Python | 3.13 | ADR 0005 |
| `onnxruntime` | 1.30.0 | ADR 0005 |
| `numpy` | 2.5.3 | ADR 0005 |
| `ruff` | 0.16.10 | ADR 0005 |
| `torch` | 2.14.1 | PyPI em 2026-10-09; só na conversão |
| `onnx` | 1.23.2 | PyPI em 2026-10-09; só na conversão |
| `onnxscript` | 0.7.2 | PyPI em 2026-10-09; só na conversão, exigido pelo exportador do `torch` |

As três últimas declaram Python a partir da 3.10. A execução real em 3.13 é provada pela Task 1.

---

## Acceptance Criteria

### Contrato

N/A — o levantamento não cria rota HTTP. O contrato são os dois scripts e o documento abaixo.

| Artefato | O que faz |
| --- | --- |
| `docs/research/liveness/convert_minifasnet.py` | lê um `.pth` do clone do repositório oficial, exporta o ONNX e confere a saída dele contra a do PyTorch |
| `docs/research/liveness/measure_latency.py` | carrega um ou mais `.onnx` no `onnxruntime` e mede a latência em CPU |
| `docs/research/liveness/README.md` | o documento: os candidatos comparados, as medições, a regra aplicada e a recomendação |

### Request

Argumentos de linha de comando. Nenhum tem valor padrão.

`convert_minifasnet.py`

| Argumento | Tipo | Obrigatório | Validação |
| --- | --- | --- | --- |
| `--repo` | caminho | Sim | diretório do clone do repositório oficial no commit `b6d5f04`, fora do Vultra |
| `--weights` | caminho | Sim | um dos dois `.pth` de `resources/anti_spoof_models/` |
| `--output` | caminho | Sim | arquivo `.onnx` a gravar, fora do Vultra |

`measure_latency.py`

| Argumento | Tipo | Obrigatório | Validação |
| --- | --- | --- | --- |
| `--model` | caminho, repetível | Sim, ao menos um | arquivo `.onnx`. Dois ou mais são medidos como um par: uma medida é a execução de todos em sequência |

### Response

Uma linha na saída padrão por execução, e código de saída 0. As mensagens estão nas regras 3 e 4.

### Perfis e privilégios

N/A — não há usuário nem rota. Os scripts rodam na máquina de quem desenvolve.

### O documento

`docs/research/liveness/README.md` tem estas seções, nesta ordem.

| Seção | Conteúdo |
| --- | --- |
| Candidatos | uma tabela com uma coluna por candidato e as linhas da regra 2 |
| Conversão | o comando executado, a versão de cada ferramenta e, por arquivo gerado, o opset, o SHA-256 e a diferença máxima contra o PyTorch |
| Latência | o processador, o sistema operacional, e p50 e p95 em milissegundos por candidato e do `best_model_quantized.onnx` |
| Regra de decisão | a regra 5 aplicada: quem foi eliminado e por quê, e a ordem dos que sobraram |
| Recomendação | o modelo recomendado e se o ADR 0006 é confirmado ou emendado |

---

## Regras de Negócio

### 1. Autorização

N/A — não há operação autenticada.

### 2. Cada candidato é descrito pelos mesmos campos

Todo campo traz a fonte: o arquivo e o commit de onde saiu, ou a URL. Um campo que a fonte não informa é
registrado como `não publicado`, nunca deixado vazio.

| Campo | Origem do dado |
| --- | --- |
| Arquitetura | o código do repositório do candidato |
| Entrada: dimensão, ordem dos canais e normalização | o código de pré-processamento do repositório |
| Fator de recorte do rosto | o código de pré-processamento do repositório |
| Classes de saída e a ordem delas | o código de inferência do repositório |
| Licença do código | o arquivo `LICENSE` do repositório |
| Licença do peso | o `LICENSE` e o `README` do repositório |
| Dataset de treino e a licença dele | o `README` do repositório e a página do dataset |
| Origem do ONNX | `oficial`, `convertido por terceiro` ou `convertido por nós` |
| Resultado publicado e o dataset | o `README` ou o artigo do candidato, com a métrica nomeada |
| Executa no `onnxruntime` 1.30.0 | a execução da regra 4 |
| Latência em CPU, p50 e p95 | a execução da regra 4 |

### 3. O ONNX convertido por nós é reproduzível e equivalente ao peso oficial

- O `.pth` é carregado com `torch.load(..., weights_only=True)`. Nenhum outro modo de carga é usado.
- A exportação usa `torch.onnx.export`, com o modelo em modo de avaliação.
- Depois de exportar, o script roda o mesmo tensor aleatório, de semente fixa `0`, no PyTorch e no
  `onnxruntime`, e compara as saídas.
- Com diferença absoluta máxima de até `1e-4`, o script registra e sai com 0:
  > `converted model=<arquivo> opset=<n> sha256=<hex> max_abs_diff=<x>`
- Acima de `1e-4`, o script apaga o arquivo gerado, registra e sai com 1:
  > `conversion mismatch model=<arquivo> max_abs_diff=<x>`
- A conversão é aprovada quando os dois `.pth` oficiais produzem a primeira linha.

### 4. A latência é medida do mesmo jeito para todos

- Sessão do `onnxruntime` com `CPUExecutionProvider` e uma thread (`intra_op_num_threads=1`).
- A entrada é um tensor `float32` aleatório, de semente fixa `0`, com a forma que a própria sessão
  declara.
- 50 execuções de aquecimento, descartadas, e 1000 execuções medidas com `time.perf_counter_ns`.
- O script registra e sai com 0:
  > `latency model=<arquivos> runs=1000 p50_ms=<x> p95_ms=<x>`
- Um `.onnx` que o `onnxruntime` não carrega ou não executa faz o script sair com 1, com a exceção do
  próprio runtime. O candidato é registrado como `não executa` com a mensagem da exceção.
- O par oficial é medido com os dois `--model` na mesma chamada.

### 5. A recomendação sai da regra, escrita antes da medição

Eliminação, nesta ordem. Um candidato eliminado continua na tabela, com o motivo.

1. A licença do código, do peso ou do dataset de treino proíbe o uso em pesquisa não comercial.
2. O `.onnx` não executa no `onnxruntime` 1.30.0.
3. A origem do ONNX não se reproduz: o convertido por nós reprova a regra 3, ou o de terceiro não tem
   SHA-256 publicado na release.

Ordenação dos que sobram:

1. Vence o candidato cuja saída distingue foto impressa de tela.
2. Persistindo o empate, vence o de menor p95.

Se nenhum candidato sobra, a recomendação registra isso, o ADR 0006 não é alterado e a escolha volta a
Theo antes da spec do #174.

### 6. O resultado decide o ADR 0006

- Aceita a recomendação, o ADR 0006 ganha a seção `Levantamento de modelos de vivacidade`, com o link
  para o documento, a origem do ONNX, o SHA-256 do arquivo e a latência medida.
- Se o recomendado é o MiniFASNetV2 oficial sozinho, a linha `Vivacidade` da tabela de modelos fica como
  está. Se é outro, a linha é emendada, com a data e o nome de quem aceitou.
- A decisão de aceitar é de Theo e é registrada com a data.

### 7. Nenhum peso entra no repositório

- Os `.pth`, os `.onnx` e o clone do repositório oficial ficam fora da árvore do Vultra.
- O documento registra, por arquivo, a URL de origem e o SHA-256.

### 8. Persistência e Auditoria

- **Tabelas/colunas alteradas:** N/A — o levantamento não toca o banco.
- **Auditoria:** N/A — não há operação de usuário.
- **Eventos/integrações disparados:** N/A.

---

## Erros

Não há código de erro HTTP. Os desfechos de falha são estes.

| Desfecho | Quando | Mensagem |
| --- | --- | --- |
| Conversão divergente | a saída do ONNX difere da do PyTorch em mais de `1e-4` | `conversion mismatch model=<arquivo> max_abs_diff=<x>` |
| Modelo não executa | o `onnxruntime` 1.30.0 recusa o arquivo | a exceção do `onnxruntime`, sem tratamento |
| Argumento ausente | um argumento obrigatório não foi passado | a mensagem de uso do `argparse` |

## Efeitos Colaterais

- **Persistência:** `convert_minifasnet.py` grava só o arquivo de `--output`. `measure_latency.py` não
  grava nada.
- **Concorrência:** N/A — uma execução por vez, à mão.
- **Transação:** N/A.

---

## Cenários de Aceite (Gherkin)

### Cenário 1 — Conversão equivalente do peso oficial (caminho feliz)

```gherkin
Dado o clone do repositório oficial no commit `b6d5f04`
Quando `convert_minifasnet.py` roda com `2.7_80x80_MiniFASNetV2.pth`
E roda com `4_0_0_80x80_MiniFASNetV1SE.pth`
Então cada execução imprime `converted model=<arquivo> opset=<n> sha256=<hex> max_abs_diff=<x>`
E `max_abs_diff` é de no máximo `1e-4` nas duas
```

### Cenário 2 — Conversão divergente (exceção)

```gherkin
Dado um ONNX cuja saída difere da do PyTorch em mais de `1e-4`
Quando `convert_minifasnet.py` compara as saídas
Então imprime `conversion mismatch model=<arquivo> max_abs_diff=<x>`
E o arquivo de `--output` não existe
E o código de saída é 1
```

### Cenário 3 — Latência dos candidatos (caminho feliz)

```gherkin
Dado os dois ONNX convertidos e os dois ONNX da release v1.0.0, com o SHA-256 conferido
Quando `measure_latency.py` roda para o V2 oficial, para o par oficial, para o `best_model.onnx` e para o `best_model_quantized.onnx`
Então cada execução imprime `latency model=<arquivos> runs=1000 p50_ms=<x> p95_ms=<x>`
E o documento registra as quatro linhas, o processador e o sistema operacional
```

### Cenário 4 — O documento compara e recomenda (caminho feliz)

```gherkin
Dado os três candidatos descritos pelos campos da regra 2, cada campo com a fonte
Quando a regra 5 é aplicada
Então a seção `Regra de decisão` nomeia cada eliminado com o motivo e a ordem dos que sobraram
E a seção `Recomendação` nomeia um modelo e diz se o ADR 0006 é confirmado ou emendado
E `git status` não lista nenhum `.onnx` nem `.pth`
```

### Cenário 5 — Nenhum candidato sobra (caminho alternativo)

```gherkin
Dado que a regra 5 eliminou os três candidatos
Quando a recomendação é escrita
Então ela registra que nenhum candidato passou e o motivo de cada um
E o ADR 0006 não é alterado
```

### Cenário 6 — Arquivo que o runtime recusa (exceção)

```gherkin
Dado um arquivo `.onnx` truncado
Quando `measure_latency.py` roda com ele
Então a exceção do `onnxruntime` aparece na saída de erro
E nenhuma linha `latency` é impressa
E o código de saída é 1
```

### Cenário 7 — O ADR recebe o resultado

```gherkin
Dado que Theo aceitou a recomendação
Quando o resultado é registrado
Então o ADR 0006 traz a seção `Levantamento de modelos de vivacidade` com a origem do ONNX, o SHA-256 e a latência
E a linha `Vivacidade` da tabela de modelos nomeia o modelo aceito
```

---

## Impacto na arquitetura

Tudo abaixo muda com o resultado, na Task 2. Nada muda no mapa ao fechar esta spec.

- **Pipeline** (`building-blocks/pipeline.md`): a linha `Vivacidade` da tabela de etapas nomeia o modelo
  aceito.
- **Riscos** (`risks.md`): a linha "A robustez do MiniFASNetV2 depende do modelo da câmera" passa a
  nomear o modelo aceito, com a ressalva que o repositório dele declara.
- **ADR 0006**: a seção de resultado e, se o modelo mudar, a linha da tabela, pela regra 6.
- **`AGENTS.md` da raiz**: a linha `Inferência` da tabela de stack, se o modelo mudar.
- **`zensical.toml`**: a página do levantamento entra na navegação de pesquisa, na Task 1.
- **Serviço**, **Câmera** e os cenários de runtime: sem mudança.

## Impacto no modelo de dados

N/A — o levantamento não cria nem lê tabela.

## Fora de Escopo

- Medição de acurácia, de taxa de bloqueio ou de falsa recusa em qualquer dataset: é medição do artigo,
  depende da [OQ-07](../requirements/open-questions.md#oq-07).
- Teste com a ESP32-CAM real, com foto impressa ou com tela: épico #174 e épico #179.
- Candidatos fora dos três da premissa 1. Um quarto candidato é outra issue.
- Onde o pipeline busca o peso, como ele é distribuído e conferido na carga: spec do épico #174.
- Pré-processamento, limiar de decisão e código de recusa da vivacidade: spec do épico #174.
- Latência no ambiente de nuvem e o orçamento da
  [OQ-03](../requirements/open-questions.md#oq-03): épico #179. O número medido aqui é um insumo de
  comparação, não a medida do artigo.
- Quantização feita por nós e treino ou ajuste fino de qualquer modelo.
- `torch` como dependência do repositório.
- Teste automatizado dos scripts: `docs/research` não tem runner, e a verificação é a execução
  registrada no documento.

## Quebra em Tasks

As duas são entregas da issue #183, um commit cada, na branch `chore/183-liveness-model-survey`. Não
viram sub-issues.

| # | Título | Escopo | Critério de aceite | Depende de |
| --- | --- | --- | --- | --- |
| 1 | Add the liveness model survey with its conversion and latency scripts | `docs/research/liveness/README.md`, `docs/research/liveness/convert_minifasnet.py`, `docs/research/liveness/measure_latency.py`, `zensical.toml` | `ruff check` e `ruff format --check` na 0.16.10 sem erro nos dois scripts (`mypy` ausente: `docs/research` não tem configuração de tipos); `uvx zensical build` sem aviso; Cenários 1, 2, 3, 4 e 6 executados, ou o Cenário 5 no lugar do 4 | — |
| 2 | Record the liveness model decision in ADR 0006 | `docs/decisions/0006-inferencia-no-processo-do-servico.md`, `docs/architecture/building-blocks/pipeline.md`, `docs/architecture/risks.md`, `AGENTS.md` | Cenário 7; `uvx zensical build` sem aviso | 1 |
