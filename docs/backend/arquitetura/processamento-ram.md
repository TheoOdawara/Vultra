# 🧠 Processamento Biométrico RAM-Only

> **← [Voltar ao Backend](../README.md)**
> Veja também as regras de segurança: [guias/seguranca-lgpd.md](../guias/seguranca-lgpd.md)

O processamento biométrico do VULTRA ocorre **integralmente na RAM** do AI Service. Nenhum dado de imagem toca o disco em nenhuma etapa.

---

## Fluxo Obrigatório

```
ESP32-CAM → API Core (base64) → Redis Queue
                                      │
                              [AI Service — RAM]
                                      │
                              DeepFace.represent()
                                      │
                              vector float32[512]
                                      │
                    Redis Result ◀────┘  (imagem destruída aqui)
                          │
                    API Core recebe vetor
                          │
                    PostgreSQL (apenas vetor — nunca imagem)
```

---

## FaceService — Comportamento

A classe `FaceService` (em `services/face_service.py`) é o núcleo do AI Service. Não realiza nenhuma operação de I/O em disco.

### Passos internos

| Passo | Ação | Observação |
|-------|------|------------|
| 1 | **Warm-up no startup** | Modelo ArcFace pré-carregado em memória via `lifespan` do FastAPI |
| 2 | **Decode do frame** | `base64` → `numpy.ndarray` via `io.BytesIO` + `PIL.Image` — sem `cv2.imwrite()` |
| 3 | **Representação** | `DeepFace.represent(enforce_detection=True, align=True)` → lista com `embedding[0]` (512 floats) |
| 4 | **Sentimento** (opcional) | `DeepFace.analyze(actions=['emotion'])` no mesmo array numpy, ainda em RAM |
| 5 | **Limpeza** | Deleta referência ao array; garbage collector libera a memória |
| — | **Sem face detectada** | Retorna `success=False, error='NO_FACE_DETECTED'` |

---

## Worker de Fila Redux (`EmbeddingWorker`)

O worker fica em `workers/embedding_worker.py` e roda como `asyncio.Task` iniciada pelo `lifespan` do FastAPI.

### Loop de consumo

```
1. BLPOP vultra:queue:embedding  (timeout 5s — não bloqueia event loop)
2. Deserializa JSON → EmbeddingJob (Pydantic)
3. Delega ao FaceService via run_in_executor (thread pool)
4. Publica resultado em vultra:result:{job_id} (SETEX, TTL 60s)
   └── imagem já destruída dentro do FaceService antes deste passo
```

> O uso de `run_in_executor` é obrigatório pois DeepFace/TensorFlow são síncronos e bloqueariam o event loop asyncio se chamados diretamente.

---

## FastAPI App — Lifespan

O `lifespan` gerencia o ciclo de vida completo do AI Service:

| Fase | Ação |
|------|------|
| **Startup** | Instancia `FaceService` (warm-up do modelo ArcFace) → inicia `EmbeddingWorker` como `asyncio.Task` |
| **Runtime** | Worker processa jobs; `GET /health` retorna status do worker e modelo carregado |
| **Shutdown** | Cancela a task do worker gracefully |

O Swagger UI (`/docs`) é desabilitado em ambiente de produção (`DEBUG=false`).
