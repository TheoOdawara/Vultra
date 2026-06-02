# 🧠 Processamento Biométrico RAM-Only

> **← [Voltar ao Backend](../README.md)**
> Veja também as regras de segurança: [guias/seguranca-lgpd.md](../guias/seguranca-lgpd.md)

O processamento biométrico do VULTRA ocorre **integralmente na RAM** do AI Service. Nenhum dado de imagem toca o disco em nenhuma etapa.

---

## Fluxo Obrigatório

```
ESP32-CAM → API Core (base64) → Redis Queue (ai:recognition:queue)
                                      │
                              [AI Service — RAM]
                                      │
                              InsightFace FaceAnalysis
                              ├── RetinaFace: detecção de face
                              ├── Validação de qualidade (blur, brilho, centralização)
                              └── ArcFace: embedding 512d
                                      │
                    Redis Result ◀────┘  (imagem destruída aqui)
                    (ai:recognition:result:{jobId})
                          │
                    API Core recebe embedding
                          │
                    pgvector: busca cosseno → membro mais próximo
                          │
                    PostgreSQL (apenas vetor — nunca imagem)
```

---

## FaceService — Comportamento

A classe `FaceService` (em `apps/ai-service/services/face_service.py`) é o núcleo do AI Service. Não realiza nenhuma operação de I/O em disco.

### Passos internos (`_process_sync`)

| Passo | Ação | Observação |
|-------|------|------------|
| 1 | **Decode do frame** | `base64` → `bytes` → `numpy.ndarray BGR` via `cv2.imdecode()` — sem `cv2.imwrite()` |
| 2 | **Detecção de face** | `FaceAnalysis.get(img)` (InsightFace `buffalo_l`) — retorna lista de faces detectadas |
| 3 | **Validação de unicidade** | Exatamente 1 face é obrigatória: 0 → `NO_FACE_DETECTED`, 2+ → `MULTIPLE_FACES` |
| 4 | **Validação de qualidade** | `validate_quality()`: bbox ≥ 50px, Laplacian var > 100, brilho [40,220], centralização [0.3,0.7] |
| 5 | **Embedding ArcFace** | `face.embedding.tolist()` → vetor `float32[512]` |
| 6 | **Limpeza** | `del img` — garbage collector libera a memória |

> O processamento síncrono (`_process_sync`) é delegado a um `ThreadPoolExecutor` (4 workers) via `asyncio.run_in_executor`. Isso é obrigatório pois InsightFace/ONNX são operações CPU-bound síncronas que bloqueariam o event loop asyncio se chamadas diretamente.

---

## RedisWorker

O worker fica em `apps/ai-service/workers/redis_worker.py` e roda como `asyncio.Task` iniciada pelo `lifespan` do FastAPI.

### Loop de consumo (`_consume_loop`)

```
1. BLPOP ai:recognition:queue  (timeout=2s — não bloqueia event loop)
2. Deserializa JSON → AIJob (Pydantic)
3. Delega ao FaceService via asyncio.wait_for (timeout=JOB_TIMEOUT_S)
4. Publica AIResult em ai:recognition:result:{job_id} (SETEX, TTL 60s)
   └── imagem já destruída dentro do FaceService antes deste passo
```

---

## FastAPI App — Lifespan

O `lifespan` gerencia o ciclo de vida completo do AI Service:

| Fase | Ação |
|------|------|
| **Startup** | Instancia `FaceService` + `FaceService.load_models()` (warm-up InsightFace `buffalo_l`) → cria Redis client → inicia `RedisWorker` como `asyncio.Task` |
| **Runtime** | Worker processa jobs da fila; `GET /health` retorna `status` e `model` |
| **Shutdown** | `worker.stop()` cancela a task gracefully; fecha conexão Redis |

O Swagger UI (`/docs`) é desabilitado em ambiente de produção (`DEBUG=false`).

---

## Modelo InsightFace (`buffalo_l`)

O pack `buffalo_l` inclui dois modelos:

| Componente | Modelo | Finalidade |
|------------|--------|------------|
| Detector | RetinaFace | Localização de face + landmarks no frame |
| Embedder | ArcFace | Geração do vetor 512d para comparação cosseno |

O modelo é pré-baixado durante o `docker build` (`Dockerfile` linha de pre-download) para eliminar latência no cold-start em produção. Em desenvolvimento, é baixado automaticamente para `~/.insightface/models/` no primeiro uso.
