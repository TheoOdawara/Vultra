# Tarefa: [FEAT] Implantar Reconhecimento Facial (PoC)

Este arquivo foi reorganizado para tornar as tarefas atômicas, com IDs para rastreamento e dependências.

## Tarefas

- [ ] face-planning: Planejamento PoC de reconhecimento facial
  - Descrição: Confirmar escopo PoC, endpoints, uso de câmera local, arquitetura do AI service e requisitos LGPD.

- [ ] ai-service-python: Infra AI Service (FastAPI)
  - Descrição: Criar microserviço FastAPI com POST /process-image que gera embedding(512) em RAM; NÃO persistir imagens.

- [ ] db-drizzle-face-embeddings: DB — migration face_embeddings
  - Descrição: Criar migration Drizzle para tabela face_embeddings (id, organizationId, subjectId, embedding vector(512), metadata JSON, created_at, updated_at) e índices de similarity.

- [ ] backend-elysia-face-routes: API Backend — rotas /v1/face/*
  - Descrição: Implementar /v1/face/enroll, /v1/face/verify, /v1/face/list, /v1/face/delete com validação TypeBox, Better Auth + RBAC e filtragem por organizationId.

- [ ] queue-redis-setup: Queue (Redis) e redis-ai-queue
  - Descrição: Implementar producer/consumer; permitir modo síncrono para PoC e preparar integração por Redis queue posteriormente.

- [ ] client-poc-web: Cliente PoC (Web)
  - Descrição: Página simples com getUserMedia para capturar foto e enviar para /v1/face/enroll e /v1/face/verify; exibir resultado e score.

- [ ] lgpd-security: LGPD & Segurança
  - Descrição: Consultar skill lgpd-biometrics; documentar retenção zero de imagens; política de logs e procedimentos de eliminação de dados sensíveis.

- [ ] tests-face: Testes (unitário e integração)
  - Descrição: Escrever testes de casos de uso (unit) e integração das rotas; garantir `bun test` passando.

- [ ] docs-face-readme: Documentação (/docs/face/README.md)
  - Descrição: Documentar endpoints, fluxos, considerações LGPD e integração futura com ESP32.

- [ ] esp32-planning-phase-2: Planejamento ESP32 (Fase 2)
  - Descrição: Definir endpoints, autenticação X-Device-Token e requisitos de firmware para ESP32-CAM.

## Observações e regras do projeto

- Multitenancy: todas as queries e APIs devem filtrar por `organizationId`.
- Nunca persistir imagens em disco ou BD — só embeddings (vector(512)).
- Rotas devem usar prefixo `/v1/`.
- Convencional commits: feat:, fix:, docs:, refactor:, chore:.

## Registro de progresso

- Tarefa de sessão atual (in_progress): `implantar-reconhecimento-facial-poc` (mantida).
- Antes de iniciar implementações: mover qualquer item marcado [x] deste arquivo para `.github/task/history.md` (nenhum encontrado no varrimento atual).

---

