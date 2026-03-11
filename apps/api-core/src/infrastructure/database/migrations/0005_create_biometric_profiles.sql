-- ============================================================
-- VULTRA — Migration 0005
-- Perfis biométricos: embedding facial 512-dim (LGPD Art. 11)
-- PROIBIDO armazenar imagem — apenas o vetor numérico é persistido
-- ============================================================

-- UP
BEGIN;

CREATE TABLE biometric_profiles (
  id              UUID        NOT NULL DEFAULT gen_uuid_v7(),
  organization_id UUID        NOT NULL,
  member_id       UUID        NOT NULL,
  face_embedding  VECTOR(512) NOT NULL,         -- ArcFace 512-dim. Proibido imagem (LGPD)
  model_version   TEXT        NOT NULL DEFAULT 'ArcFace-v1',
  quality_score   REAL        NOT NULL,         -- Score de qualidade do enroll [0, 1]
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  enrolled_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_matched_at TIMESTAMPTZ,

  CONSTRAINT biometric_profiles_pkey          PRIMARY KEY (id),
  CONSTRAINT biometric_profiles_member_fkey   FOREIGN KEY (member_id)
                                                REFERENCES members (id) ON DELETE RESTRICT,
  CONSTRAINT biometric_profiles_org_fkey      FOREIGN KEY (organization_id)
                                                REFERENCES organizations (id) ON DELETE RESTRICT,
  -- score de qualidade mínimo e máximo — garante integridade do dado de enroll
  CONSTRAINT biometric_profiles_quality_check CHECK (quality_score BETWEEN 0.0 AND 1.0)
);

COMMENT ON TABLE  biometric_profiles                IS 'Perfis biométricos — LGPD Art. 11: dados biométricos de categoria especial. Somente vetores.';
COMMENT ON COLUMN biometric_profiles.face_embedding IS 'Embedding facial ArcFace 512-dim. Entrada na RAM, vetor persistido, imagem descartada imediatamente';
COMMENT ON COLUMN biometric_profiles.model_version  IS 'Versão exata do modelo gerador. OBRIGATÓRIO filtrar por este campo em queries de reconhecimento';
COMMENT ON COLUMN biometric_profiles.quality_score  IS 'Score de qualidade do enroll [0,1]. Mínimo recomendado: 0.7. Rejeitar < 0.5';
COMMENT ON COLUMN biometric_profiles.is_active      IS 'FALSE = desativado (migração de modelo, revogação do titular ou exclusão LGPD)';

-- Índices B-Tree compostos
CREATE INDEX idx_biometric_profiles_org_id
  ON biometric_profiles (organization_id);

CREATE INDEX idx_biometric_profiles_member_id
  ON biometric_profiles (member_id);

-- Índice para queries de reconhecimento: filtra pelo tenant + modelo ativo antes do HNSW
CREATE INDEX idx_biometric_profiles_org_model_active
  ON biometric_profiles (organization_id, model_version)
  WHERE is_active = TRUE;

-- Índice parcial: garante apenas UM perfil ativo por (membro, versão de modelo)
-- Perfis inativos (histórico de migrações) são permitidos em múltiplos registros
CREATE UNIQUE INDEX idx_biometric_profiles_active_per_member_model
  ON biometric_profiles (member_id, model_version)
  WHERE is_active = TRUE;

-- NOTA: O índice HNSW em face_embedding é criado na migration 0009 separadamente,
--       pois pode exigir CREATE INDEX CONCURRENTLY em produção com dados existentes.

-- Row-Level Security
ALTER TABLE biometric_profiles ENABLE  ROW LEVEL SECURITY;
ALTER TABLE biometric_profiles FORCE   ROW LEVEL SECURITY;

CREATE POLICY biometric_profiles_tenant_isolation ON biometric_profiles
  AS PERMISSIVE FOR ALL
  TO PUBLIC
  USING (
    organization_id = NULLIF(current_setting('app.current_org_id', TRUE), '')::UUID
  )
  WITH CHECK (
    organization_id = NULLIF(current_setting('app.current_org_id', TRUE), '')::UUID
  );

COMMIT;

-- DOWN
BEGIN;
DROP POLICY IF EXISTS biometric_profiles_tenant_isolation ON biometric_profiles;
DROP TABLE  IF EXISTS biometric_profiles;
COMMIT;
