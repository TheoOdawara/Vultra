# 📊 Modelos de IA — Seleção e Tradeoffs

> **← [Voltar ao Backend](../README.md)**
> Veja a configuração em: [manuais/configuracao.md](../manuais/configuracao.md)

---

## Engine de IA: InsightFace

O VULTRA usa [InsightFace](https://github.com/deepinsight/insightface) como engine de reconhecimento facial, com o backend de inferência **ONNX Runtime** (CPU ou CUDA). O framework anterior (DeepFace/TensorFlow) foi substituído — ver [ADR-002](../adrs/ADR-002-arcface-modelo-padrao.md).

---

## Model Packs Suportados

InsightFace organiza modelos em "packs" que agrupam detector + embedder.

| Pack | Detector | Embedder | Dim. | Precisão LFW | Latência CPU (~) | Uso recomendado |
|------|----------|----------|------|:------------:|:---------------:|-----------------|
| **`buffalo_l`** | RetinaFace | ArcFace R100 | 512 | 99.77% | ~80ms | ✅ **Padrão VULTRA — produção** |
| `buffalo_m` | RetinaFace | ArcFace R50 | 512 | 99.65% | ~50ms | Alternativa leve (mesmo threshold) |
| `buffalo_s` | RetinaFace | MobileFaceNet | 512 | 99.20% | ~25ms | Hardware muito limitado |

> **Configuração:** variável de ambiente `MODEL_NAME` (padrão: `buffalo_l`).

---

## Threshold de Confiança (Cosseno)

Os thresholds são calibrados para `buffalo_l` (ArcFace R100). Não aplique os mesmos valores a outros modelos sem recalibração.

| Intervalo de similaridade | Resultado | Ação da API |
|---------------------------|-----------|-------------|
| `>= 0.85` (`FACE_MATCH_THRESHOLD`) | Match confirmado | Registra presença automaticamente |
| `>= 0.40` e `< 0.85` (`LOW_CONFIDENCE_THRESHOLD`) | Match incerto | `LOW_CONFIDENCE_MATCH` (422) — requer revisão manual |
| `< 0.40` | Não reconhecido | `FACE_NOT_RECOGNIZED` (404) |

Constantes em `apps/api-core/src/core/domain/constants.ts`.

---

## Validação de Qualidade do Frame

Antes de gerar o embedding, `frame_validator.py` aplica as seguintes regras:

| Regra | Limite | Código de erro |
|-------|--------|----------------|
| Tamanho mínimo da face | ≥ 50 px (largura e altura) | `LOW_QUALITY` |
| Variância Laplaciana (nitidez) | > 100 | `LOW_QUALITY` |
| Brilho médio (escala de cinza) | [40, 220] | `LOW_QUALITY` |
| Centralização da face | cx, cy ∈ [0.30, 0.70] | `LOW_QUALITY` |
| Score composto mínimo | ≥ 0.40 | `LOW_QUALITY` |
| Exatamente 1 face no frame | = 1 | `NO_FACE_DETECTED` / `MULTIPLE_FACES` |

---

## Troca de Modelo em Produção

> ⚠️ **Atenção:** Trocar o modelo invalida todos os embeddings existentes.  
> Leia **obrigatoriamente** [database/arquitetura/versionamento-embeddings.md](../../database/arquitetura/versionamento-embeddings.md) antes de qualquer alteração em `MODEL_NAME`.

Resumo do risco: como imagens não são armazenadas (LGPD), a troca de modelo exige **re-enrollment físico** de todos os membros afetados via ESP32-CAM. O campo `model_version` em `biometric_profiles` rastreia qual modelo gerou cada embedding — perfis antigos convivem com novos durante a migração, mas não são comparados entre si.

---

## ONNX Runtime vs CUDA

O InsightFace suporta dois providers de execução, configurados no código via `providers=`:

| Provider | Quando usar |
|----------|-------------|
| `CUDAExecutionProvider` | Servidor com GPU NVIDIA (latência < 10ms) |
| `CPUExecutionProvider` | Fallback automático sem GPU (latência ~80ms) |

O código em `FaceService.load_models()` tenta CUDA primeiro e cai em CPU se indisponível — sem mudança de configuração necessária.
