# Backlog — Reconhecimento Facial (Sprint Ativa)

> Diretório canônico de task management: `.github/tasks/`
> Fonte de verdade do backlog ativo do Vultra. Antes de editar, migrar itens concluídos para `history.md`.
> GitHub Project: `Vultra` — https://github.com/users/TheoOdawara/projects/1
 
> Sprint ativa desde: 2026-03-27
> Última auditoria: 2026-04-07 (sessão 84c54233)
> Decisões confirmadas no plano (sessão dedc54a7):
> - Reutilizar tabela `biometric_profiles` (não criar `face_embeddings`)
> - Modo primário: Redis + Circuit Breaker; HTTP síncrono apenas atalho local
> - Thresholds: MATCH > 0.85 | POSSÍVEL 0.75–0.85 | SEM MATCH < 0.75
> - Qualidade: < 0.40 rejeita | 0.40–0.60 aviso | 0.60–0.75 média | > 0.75 alta
> - RBAC: admin→tudo | professor→enroll/verify/list/delete | rh→list/verify
> - Frame base64 máx 1 MB | timeout HTTP/Redis 3000 ms | TTL Redis 60 s | CB abre após 5 falhas
> - Rate limiting: user 5 RPS burst 10 bloqueio 60 s | org 20 RPS bloqueio 60 s
> - Segurança (OWASP/LGPD): Proteção contra injeção, headers de segurança, logs sem PII, isolamento estrito por tenant.
> - Revogação biométrica: contrato canônico `DELETE /v1/face/:profileId` (decisão confirmada em 2026-04-25)
> - Verify: `POST /v1/face/verify` responde `200` com resultado estruturado (`MATCH` | `POSSÍVEL` | `SEM_MATCH`); erros HTTP ficam reservados para input inválido, auth/authz, rate limit e indisponibilidade do AI Service
> - Semântica de `memberId?` no verify: filtro opcional 1:N dentro da organização; se informado, a busca por similaridade considera apenas perfis ativos do membro
> - Cutover de rota: substituição imediata de `/v1/biometric/*` por `/v1/face/*`, sem alias temporário
> - Legado `/v1/biometric/*`: após o cutover deve responder `404`
> - Rate limiting: autenticação antes do limiter; resposta `429` com header `Retry-After`; vence o primeiro limite excedido entre usuário e organização
> - Ordem técnica: migration/schema/repositório de `biometric_profiles` devem ser alinhados antes da implementação final de verify/list/audit log
> - Ordem mandatória de execução desta sprint: Execução 01 [FIX] merge/package → Execução 02 [FIX] TypeScript strict + bun install → Execução 03 [DATA] migration/schema biometria → Execução 04 [FEAT] testes (fase 1: criar cenários/vermelho) → Execução 05 [FEAT] use cases biométricos → Execução 06 [FEAT] rotas `/v1/face` → Execução 07 [FEAT] audit log biométrico → Execução 08 [FEAT] testes (fase 2: fazer todos passar) → Execução 09 [DOCS]
> - Verify sem match ou sem perfis cadastrados: responder `200` com `result='SEM_MATCH'`, `confidence=0`, sem `memberId` no payload de resposta
> - `jobId` em enroll/verify é gerado na camada de rota via `createId()` e repassado ao use case
> - Precedência em verify com `memberId`: se o membro informado não existir no tenant atual, responder `404`; se existir, seguir fluxo normal e responder `200` com resultado biométrico
> - Revoke HTTP: sucesso em `200 { success: true }`; `profileId` inexistente ou fora da organização responde `404`
> - Audit log biométrico: somente requisições autenticadas que alcançam o use case geram entrada em `audit_logs`; erros prévios de schema/auth/authz/rate-limit não entram nessa tabela
> - Identidade do ator biométrico: Better Auth deve gerar IDs UUID string (`advanced.database.generateId='uuid'`); colunas `actor_id`, `created_by` e `deleted_by` permanecem `UUID`
> - Contratos HTTP observáveis: TypeBox/input inválido responde `422`; isolamento entre tenants em recursos biométricos responde `404`
> - Indisponibilidade do AI Service / Circuit Breaker: responder `503` com código `AI_SERVICE_UNAVAILABLE`; quando houver `retryAfter`, expor também header `Retry-After`
> - `Retry-After` só é obrigatório quando o Circuit Breaker estiver OPEN e houver cooldown conhecido; timeouts/degradação sem cooldown explícito retornam `503` sem esse header

---

## Sequência Operacional 01→09

1. **Execução 01** — restaurar estado executável do repositório (`[FIX] Merge Conflicts`)
2. **Execução 02** — limpar instalação e typecheck base (`[FIX] TypeScript Strict + Bun Install`)
3. **Execução 03** — alinhar dados/schema/auth para a modelagem final (`[DATA] Migration 0015`)
4. **Execução 04** — criar suíte TDD biométrica e abrir gate de aprovação (`[FEAT] Testes — Fase 1`)
5. **Execução 05** — implementar os use cases biométricos finais
6. **Execução 06** — expor os contratos HTTP finais em `/v1/face`
7. **Execução 07** — integrar auditoria biométrica ponta a ponta
8. **Execução 08** — fazer a suíte passar integralmente (`[FEAT] Testes — Fase 2`)
9. **Execução 09** — consolidar documentação e ADR-006

---
