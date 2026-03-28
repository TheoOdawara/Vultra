# LGPD Biometrics — Processamento RAM-Only

## Princípio Fundamental

> **Nenhuma imagem facial toca o disco.** O binário percorre toda a pipeline em RAM (V8 heap → Redis bytes → Python heap → DeepFace) e é descartado pelo GC em cada etapa. Apenas o vetor numérico de 512 floats persiste no PostgreSQL.

---

## Pipeline Completa

```
ESP32-CAM
    │  JPEG capturado
    │  base64 encode (firmware C++)
    ▼
API Core (ElysiaJS)
    │  Recebe frame_base64 via HTTP POST /v1/iot/frames
    │  NÃO persiste, NÃO loga, NÃO salva em /tmp
    │  Cria AIJob em memória
    ▼
Redis (LPUSH vultra:queue:embedding)
    │  Payload JSON em memória Redis
    │  TTL implícito: consumido em < 3s ou timeout
    ▼
AI Service (Python Worker)
    │  BRPOP: desserializa JSON em memória Python
    │  base64.b64decode() → numpy.ndarray (RAM)
    │  DeepFace.represent(img_path=array, ...) → vector 512d
    │  numpy memory liberada após retorno
    │  NÃO usa: cv2.imwrite(), open("/tmp/..."), S3 upload
    ▼
Redis (LPUSH vultra:result:{job_id} + SETEX 60s)
    ▼
API Core
    │  BRPOP resultado: { success: true, vector: [0.12, ...] }
    │  frame_base64 original já foi GC'd pela V8
    ▼
PostgreSQL (biometric_profiles)
    │  INSERT: embedding = '[0.12, ...]'::vector(512)
    │  model_version, organization_id, member_id
    │  NÃO armazena: imagem, base64, path
    ▼
GC / Descarte
    │  Cada camada libera memória automaticamente
    │  Não há referências persistentes ao dado biométrico bruto
```

---

## Código do AI Service — Correto vs Incorreto

```python
# ✅ CORRETO — RAM only
import base64, numpy as np
from deepface import DeepFace

def process_frame(frame_base64: str) -> list[float]:
    img_bytes = base64.b64decode(frame_base64)
    img_array = np.frombuffer(img_bytes, dtype=np.uint8)
    img       = cv2.imdecode(img_array, cv2.IMREAD_COLOR)  # numpy array em RAM

    result = DeepFace.represent(
        img_path   = img,          # array direto — não precisa de arquivo
        model_name = 'ArcFace',
        enforce_detection = False,
    )
    return result[0]['embedding']  # 512 floats

# ❌ PROIBIDO — escrita em disco
def process_frame_wrong(frame_base64: str):
    with open('/tmp/frame.jpg', 'wb') as f:       # PROIBIDO
        f.write(base64.b64decode(frame_base64))
    cv2.imwrite('/app/frames/frame.jpg', img)     # PROIBIDO
    DeepFace.represent(img_path='/tmp/frame.jpg') # PROIBIDO
```

---

## Proscrito (Never Do)

| Ação | Por quê é proibido |
|------|--------------------|
| `cv2.imwrite(...)` | Persiste imagem em disco |
| `open('/tmp/...', 'wb')` | Persiste imagem em disco |
| Upload binário para S3/Storage | Persiste imagem fora do servidor |
| Armazenar em `bytea` no PostgreSQL | Persiste imagem no banco |
| Logar `frame_base64` em qualquer logger | Dado biométrico bruto em logs |
| `console.log(job)` com `job.frame_base64` | Dado biométrico bruto em logs |
