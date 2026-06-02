# ADR-002 — ArcFace como Modelo Padrão de Embeddings

> **Status:** Aceito  
> **Data:** Fevereiro 2026  
> **Contexto:** AI Service
>
> **⚠️ Errata (Maio 2026):** A decisão de usar ArcFace 512d permanece válida. No entanto, a implementação final usa **InsightFace** diretamente (via pack `buffalo_l` + ONNX Runtime), **não DeepFace/TensorFlow**. Referências a "DeepFace" abaixo são históricas — a variável de configuração real é `MODEL_NAME` (não `DEEPFACE_MODEL`). Ver [guias/modelos-ia.md](../guias/modelos-ia.md) e [arquitetura/processamento-ram.md](../arquitetura/processamento-ram.md) para a implementação atual.

---

## Contexto

O VULTRA precisa de um modelo de reconhecimento facial que gere embeddings vetoriais para armazenamento e busca por similaridade no pgvector. Os modelos candidatos foram avaliados quanto a precisão, latência e compatibilidade com o hardware alvo (ESP32-CAM, câmera 2MP).

---

## Decisão

**ArcFace** (implementação via DeepFace) foi adotado como modelo padrão, gerando vetores de **512 dimensões**.

---

## Justificativa

| Critério | ArcFace | Facenet512 | VGG-Face | DeepID |
|----------|:-------:|:----------:|:--------:|:------:|
| Precisão LFW | 99.65% | 99.65% | 98.78% | 97.45% |
| Dimensão do vetor | 512 | 512 | 4096 | 160 |
| Latência (~80ms) | ✅ adequado | ✅ (60ms) | ❌ alto | ✅ (30ms) |
| Maturidade e adoção | Alta | Alta | Média | Baixa |
| Suporte DeepFace | ✅ | ✅ | ✅ | ✅ |

ArcFace e Facenet512 têm a mesma precisão, mas ArcFace possui maior adoção em sistemas de produção e melhor documentação de comportamento em imagens de baixa qualidade (câmeras IoT).

---

## Consequências

- **Positivas:** Alta precisão com vetores compactos (512d). Compatível com HNSW no pgvector. Threshold de 0.85 (cosseno) bem estabelecido para produção.
- **Negativas:** Latência de ~80ms por frame — aceitável para o fluxo assíncrono via Redis, mas não para cenários síncronos.
- **Risco:** Trocar de modelo no futuro exige **re-enrollment físico** de todos os membros (imagens não armazenadas por LGPD). Ver [database/arquitetura/versionamento-embeddings.md](../../database/arquitetura/versionamento-embeddings.md).
- **Restrição:** A variável `DEEPFACE_MODEL` só pode ser alterada após análise de impacto de re-enrollment.
