-- ============================================================
-- VULTRA — Migration 0002
-- Tabela raiz do ecossistema multitenant: organizations
-- NOTA: Esta tabela NÃO possui RLS — gerida pelo super-admin.
-- ============================================================

-- UP

CREATE TABLE organizations (
  id         UUID        NOT NULL DEFAULT gen_uuid_v7(),
  slug       TEXT        NOT NULL,
  name       TEXT        NOT NULL,
  plan       TEXT        NOT NULL DEFAULT 'trial',
  settings   JSONB       NOT NULL DEFAULT '{}',
  is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT organizations_pkey       PRIMARY KEY (id),
  CONSTRAINT organizations_slug_key   UNIQUE (slug),
  CONSTRAINT organizations_plan_check CHECK (plan IN ('trial', 'pro', 'enterprise'))
);

COMMENT ON TABLE  organizations             IS 'Tenant raiz do ecossistema multitenant VULTRA';
COMMENT ON COLUMN organizations.slug        IS 'Identificador URL-friendly único do tenant (ex: ufabc, petrobras-rh)';
COMMENT ON COLUMN organizations.plan        IS 'Plano de assinatura: trial | pro | enterprise';
COMMENT ON COLUMN organizations.settings    IS 'Configurações livres do tenant: thresholds, integrações, limites, etc.';
COMMENT ON COLUMN organizations.is_active   IS 'FALSE = tenant desativado pela plataforma (acesso bloqueado)';

-- Índices
CREATE INDEX idx_organizations_is_active
  ON organizations (is_active)
  WHERE is_active = TRUE;

-- Trigger: updated_at automático
CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
