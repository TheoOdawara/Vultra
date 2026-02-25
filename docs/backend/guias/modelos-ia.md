# 📊 Modelos de IA — Seleção e Tradeoffs

> **← [Voltar ao Backend](../README.md)**
> Veja a configuração em: [manuais/configuracao.md](../manuais/configuracao.md)

---

## Modelos Suportados pelo DeepFace

| Modelo | Dimensões | Precisão (LFW) | Latência (~) | Uso recomendado |
|--------|-----------|----------------|--------------|-----------------|
| **ArcFace** | 512 | 99.65% | ~80ms | ✅ **Padrão VULTRA — produção** |
| Facenet512 | 512 | 99.65% | ~60ms | Alternativa leve se latência for crítica |
| VGG-Face | 4096 | 98.78% | ~200ms | Evitar — alta memória, baixa performance |
| DeepID | 160 | 97.45% | ~30ms | Apenas para hardware com CPU muito limitada |

---

## Threshold de Confiança (Cosseno)

| Intervalo | Interpretação | Ação |
|-----------|---------------|------|
| `>= 0.85` | Match confirmado | Registra presença automaticamente |
| `0.75 – 0.84` | Match incerto | Retorna `LOW_CONFIDENCE_MATCH` (422) — requer revisão manual |
| `< 0.75` | Não reconhecido | Retorna `FACE_NOT_RECOGNIZED` (404) |

O threshold `0.85` é calibrado para o modelo ArcFace. **Não aplique o mesmo threshold a outros modelos sem recalibração.**

---

## Detectores de Face

| Detector | Velocidade | Precisão | Uso |
|----------|-----------|----------|-----|
| `retinaface` | Médio | Alta | ✅ Padrão — melhor equilíbrio |
| `mtcnn` | Médio | Alta | Alternativa confiável |
| `opencv` | Rápido | Média | Apenas prototipagem/desenvolvimento |

---

## Troca de Modelo em Produção

> ⚠️ **Atenção:** Trocar o modelo invalida todos os embeddings existentes.  
> Leia **obrigatoriamente** [database/arquitetura/versionamento-embeddings.md](../../database/arquitetura/versionamento-embeddings.md) antes de qualquer alteração no `DEEPFACE_MODEL`.

Resumo do risco: como imagens não são armazenadas (LGPD), a troca de modelo exige **re-enrollment físico** de todos os membros afetados via ESP32-CAM.
