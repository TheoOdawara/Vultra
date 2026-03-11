-- ============================================================
-- VULTRA — Migration 0003
-- Membros por tenant: alunos, professores, RH e admins
-- Suporta soft-delete via deleted_at (LGPD: retenção controlada)
-- ============================================================

-- UP

CREATE TABLE members (
  id              UUID        NOT NULL DEFAULT gen_uuid_v7(),
  organization_id UUID        NOT NULL,
  user_id         UUID,                        -- FK lógica para tabela auth do Better Auth
  full_name       TEXT        NOT NULL,
  email           TEXT,
  role            TEXT        NOT NULL,
  external_code   TEXT,                        -- Matrícula ou código de funcionário
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  deleted_at      TIMESTAMPTZ,                 -- Soft-delete: NULL = ativo
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT members_pkey       PRIMARY KEY (id),
  CONSTRAINT members_org_fkey   FOREIGN KEY (organization_id)
                                  REFERENCES organizations (id) ON DELETE RESTRICT,
  CONSTRAINT members_role_check CHECK (role IN ('admin', 'professor', 'rh', 'student'))
);

COMMENT ON TABLE  members               IS 'Membros vinculados a um tenant: alunos, professores, RH e admins';
COMMENT ON COLUMN members.user_id       IS 'UUID do usuário no Better Auth (nullable: membro pode existir sem conta)';
COMMENT ON COLUMN members.external_code IS 'Matrícula (aluno) ou código de funcionário (RH) no sistema externo';
COMMENT ON COLUMN members.deleted_at    IS 'Soft-delete preenchido ao desativar membro. NULL = registro ativo';

-- Índices B-Tree compostos (tenant-first para performance multitenant)
CREATE INDEX idx_members_org_id
  ON members (organization_id);

CREATE INDEX idx_members_org_role
  ON members (organization_id, role);

CREATE INDEX idx_members_org_active
  ON members (organization_id, is_active)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_members_user_id
  ON members (user_id)
  WHERE user_id IS NOT NULL;

-- Índice parcial: unicidade de external_code por tenant (somente membros não-deletados)
CREATE UNIQUE INDEX idx_members_org_external_code_unique
  ON members (organization_id, external_code)
  WHERE external_code IS NOT NULL
    AND deleted_at IS NULL;

-- Índice trigrama para busca por nome (ex: autocomplete)
CREATE INDEX idx_members_full_name_trgm
  ON members USING GIN (full_name gin_trgm_ops);

-- Trigger: updated_at automático
CREATE TRIGGER trg_members_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- FORCE: garante isolamento mesmo para o role dono da tabela
-- Política: current_setting('app.current_org_id') via set_config() no início
--           de cada request autenticado (ver adapters/repositories/)
-- ---------------------------------------------------------------------------
ALTER TABLE members ENABLE  ROW LEVEL SECURITY;
ALTER TABLE members FORCE   ROW LEVEL SECURITY;

CREATE POLICY members_tenant_isolation ON members
  AS PERMISSIVE FOR ALL
  TO PUBLIC
  USING (
    organization_id = NULLIF(current_setting('app.current_org_id', TRUE), '')::UUID
  )
  WITH CHECK (
    organization_id = NULLIF(current_setting('app.current_org_id', TRUE), '')::UUID
  );
