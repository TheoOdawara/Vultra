# ADR-005 — Pipeline de Reconhecimento Facial (PoC e Produção)

Status: Aceito (proposta)
Data: 2026-03-22

Contexto
- A arquitetura anterior assumia comunicação exclusiva via filas Redis entre API Core (Bun) e AI Service (Python) e adotava ArcFace como modelo padrão (ADR-002).
- Mudanças recentes nas decisões de arquitetura demandam permitir um caminho simplificado para PoC (câmera do computador) usando chamadas HTTP síncronas, preservando as garantias de LGPD e a estratégia de filas para produção e integração com ESP32.

Decisão
- Definir dois modos operacionais:
  1. PoC local: comunicação HTTP síncrona segura entre cliente/backend e AI Service. Uso restrito a ambientes de desenvolvimento e testes com câmeras locais. Deve seguir as regras LGPD (RAM-only, não persistir imagens).
  2. Produção: comunicação assíncrona via Redis queues (vultra:queue:embedding / vultra:result:{jobId}) com Circuit Breaker e timeouts configuráveis. Integração com ESP32 deve usar este caminho.
- Manter ArcFace (512d) como modelo padrão por enquanto (ADR-002), mas permitir configuração via DEEPFACE_MODEL com controle de versão e avaliação de impacto (re-enrollment) antes de troca.
- Atualizar documentação para remover afirmações de exclusividade de filas e registrar esta decisão como ADR.

Consequências
- Positivas:
  - Agilidade no PoC (teste com webcam local via HTTP)
  - Produção mantém resiliência e escalabilidade com filas e Circuit Breaker
  - Risco de divergência reduzido por ADR e documentação clara
- Negativas / Riscos:
  - Possível inconsistência entre ambientes se o PoC divergir da produção; mitigado por testes de integração e documentação clara
  - Trocar modelo exige re-enrollment físico (LGPD) — alto custo operacional

Ações de follow-up
- Atualizar `docs/backend/` para remover linguagem que declare exclusividade de filas (feito).
- Criar testes de integração que cubram ambos os caminhos (HTTP sync e Redis async).
- Atualizar `fila-redis.md` com nota sobre PoC (feito) e documentar parâmetros de timeouts em `config`.
- Avisar times: criar entry em `.github/tasks/todo.md` para executar validação completa e testes antes de promoção para produção.

Justificativa
- Necessidade de acelerar validação funcional com hardware limitado (câmera local) sem comprometer a arquitetura de produção.

Assinado por: Arquitetura VULTRA
