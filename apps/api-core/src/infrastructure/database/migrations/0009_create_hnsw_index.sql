-- ============================================================
-- VULTRA — Migration 0009
-- Índice HNSW para busca vetorial de reconhecimento facial
--
-- Criado em migration separada pois:
--   1. Permite CREATE INDEX CONCURRENTLY em produção com dados existentes
--   2. É operacionalmente intensivo (consome RAM e CPU durante build)
--   3. Pode ser recriado com parâmetros diferentes sem recriar a tabela
--
-- Parâmetros (ADR-001):
--   m = 16              → conexões por nó; precisão vs. tamanho do índice
--   ef_construction = 64 → fator de build; maior = melhor recall, mais lento
--   vector_cosine_ops   → distância cosseno, alinhado com ArcFace (loss cosseno)
--
-- Escalabilidade:
--   Parâmetros atuais adequados até ~500k vetores por tenant.
--   Para > 500k: considerar m=32, ef_construction=128 (mais RAM).
--
-- ef_search (runtime):
--   O parâmetro ef_search controla o tamanho do beam na busca (padrão = 40).
--   Para aumentar o recall em produção:
--     SET hnsw.ef_search = 80;   -- por sessão, antes das queries de reconhecimento
-- ============================================================

-- UP

-- Em PRODUÇÃO com dados existentes, substituir pela versão CONCURRENTLY:
-- CREATE INDEX CONCURRENTLY idx_biometric_profiles_face_embedding_hnsw ...
CREATE INDEX idx_biometric_profiles_face_embedding_hnsw
  ON biometric_profiles
  USING hnsw (face_embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
