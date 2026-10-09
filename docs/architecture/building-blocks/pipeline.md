# Pipeline

`packages/pipeline` · Python, ONNX Runtime, InsightFace · estágio E1 · ainda não existe.

## O que faz

Recebe um quadro e a finalidade (cadastro ou reconhecimento) e devolve o resultado: a recusa com o
motivo, ou o vetor de 512 dimensões e, no reconhecimento, a emoção com a confiança.

| Etapa | Modelo | Requisito |
| --- | --- | --- |
| Detecção e contagem de rostos | InsightFace `buffalo_l`, módulo `detection` | [BR-02](../../requirements/business-rules.md#br-02) |
| Qualidade do quadro | sobre a saída da detecção | [FR-BIO-02](../../requirements/functional/biometrics.md#fr-bio-02) |
| Vivacidade | MiniFASNetV2 e MiniFASNetV1SE, com as saídas somadas | [FR-BIO-03](../../requirements/functional/biometrics.md#fr-bio-03) |
| Vetor | InsightFace `buffalo_l`, módulo `recognition` | [FR-BIO-01](../../requirements/functional/biometrics.md#fr-bio-01) |
| Emoção, só no reconhecimento | FER MobileFaceNet do OpenCV Zoo | [FR-AFF-01](../../requirements/functional/affective.md#fr-aff-01) |

## O que nunca faz

- Importar FastAPI, SQLAlchemy, Redis ou qualquer coisa de `apps/api`.
- Acessar banco, rede ou disco com o quadro.
- Comparar o vetor com a galeria: a busca 1:N é do [Serviço](service.md), no PostgreSQL.

## Para mudar com segurança

- A superfície é uma única função de entrada. O harness do artigo a importa diretamente, então mudar a
  assinatura muda o que o artigo mede.
- Os pesos do `buffalo_l` são restritos a pesquisa não comercial
  ([0006](../../decisions/0006-inferencia-no-processo-do-servico.md)).
- A ordem das etapas, os limiares e os códigos de recusa são definidos na spec do E1, ainda não escrita.
