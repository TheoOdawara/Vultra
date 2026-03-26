Vultra — Reconhecimento Facial (PoC)

Resumo:
- PoC inicial: usar câmera do computador; processar imagem em RAM; persistir somente embeddings (vector(512)).

Fluxo proposto:
- Cliente web captura foto (getUserMedia) -> Backend /v1/face/enroll (validação TypeBox) -> opcional enqueue Redis -> AI service processa e retorna embedding -> persistir embedding em face_embeddings (filtrar por organizationId).

Regras LGPD / segurança:
- Nunca persistir imagens; processar apenas em RAM.
- Logs não conterão imagens ou binários.
- Consultar skill lgpd-biometrics para aprovação final do fluxo.

Endpoints mínimos:
- GET /v1/face/health
- POST /v1/face/enroll
- POST /v1/face/verify
- GET /v1/face/list
- DELETE /v1/face/{id}

Notas:
- Multitenancy obrigatório: todas as operações devem filtrar por organizationId.
- Não persistir imagens — somente embeddings. Use pgvector (vector(512)).
- Para PoC, implementar caminho síncrono; planejar consumidor Redis para escala.