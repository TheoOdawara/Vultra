# Tarefa: [FEAT] Implantar Reconhecimento Facial (PoC com câmera local)

## Tarefa: [FEAT] Sincronizar instructions e pipeline de reconhecimento facial

- [ ] Etapa 1: Levantar mudanças nos arquivos: copilot-instructions.md, /docs, skills-lock.json e .github/* (comparar com versão anterior)
- [ ] Etapa 2: Gerar proposta de diffs para tasks, plan.md, docs/face e código afetado (apresentar para revisão)
- [ ] Etapa 3: Após aprovação, aplicar mudanças e ajustar tasks (mover concluídos para history.md)
- Observação: Pausar implementação até aprovação final da sincronização.

- [ ] Etapa 1: Planejamento (consultar /docs e plan.md)
  - Descrição: Confirmar escopo PoC — usar câmera do computador, processamento local via AI service (FastAPI + DeepFace). Não integrar ESP32 nesta fase.
- [ ] Etapa 2: Infraestrutura AI Service (Python)
  - Descrição: Criar microserviço FastAPI com endpoint POST /process-image que recebe imagem, processa embedding (512) em RAM e retorna embedding/identificação. Garantir não persistir imagens.
- [ ] Etapa 3: Banco de Dados (Drizzle)
  - Descrição: Criar migration para tabela `face_embeddings` (id, organizationId, subjectId, embedding vector(512), metadata JSON, created_at, updated_at). Incluir índices para consultas por organizationId e similarity.
- [ ] Etapa 4: API Backend (ElysiaJS)
  - Descrição: Implementar rotas /v1/face/enroll, /v1/face/verify, /v1/face/list, /v1/face/delete. Validar com TypeBox, aplicar Better Auth + RBAC e filtrar por organizationId.
- [ ] Etapa 5: Queue (Redis)
  - Descrição: Implementar producer no backend e consumer no ai-service usando protocolo redis-ai-queue. Para PoC, permitir chamada síncrona direta, mas preparar filas.
- [ ] Etapa 6: Cliente PoC (Web)
  - Descrição: Página simples com getUserMedia para capturar foto e enviar para /v1/face/enroll e verify; mostrar resultado e score.
- [ ] Etapa 7: LGPD & Segurança
  - Descrição: Consultar skill lgpd-biometrics; documentar retenção zero de imagens, política de logs (não logar imagens/binários) e procedimentos de eliminação de dados sensíveis.
- [ ] Etapa 8: Testes
  - Descrição: Escrever testes unitários para casos de uso e testes de integração para rotas. Garantir `bun test` passando antes de marcar como concluído.
- [ ] Etapa 9: Documentação
  - Descrição: Criar /docs/face/README.md com endpoints, fluxos, e considerações de LGPD e integração futura com ESP32.
- [ ] Etapa 10: Planejamento ESP32 (fase 2)
  - Descrição: Definir endpoints, autenticação X-Device-Token e firmware necessário para ESP32-CAM (deferir implementação).

## Notes
- Multitenancy obrigatório: todas as operações devem filtrar por organizationId.
- Nenhuma imagem deve ser persistida em disco ou DB. Persistir apenas embeddings (vector512).
- Rotas devem iniciar com prefixo /v1/.
- Convencional Commits obrigatórios: feat:, fix:, docs:, refactor:, chore:.

## Registro de progresso
- Antes de iniciar qualquer implementação: mover quaisquer itens concluídos [x] deste arquivo para .github/tasks/history.md conforme regra do projeto.

