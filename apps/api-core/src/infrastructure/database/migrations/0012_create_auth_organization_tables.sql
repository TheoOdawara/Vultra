-- ============================================================
-- VULTRA — Migration 0012
-- Better Auth plugin Organization: organizações, membros e convites
--
-- ATENÇÃO: `auth_organizations` ≠ `organizations` de domínio.
-- A tabela de domínio é criada separadamente via endpoint de
-- provisioning, que coordena ambas num único UseCase.
-- Consulte: docs/backend/manuais/autenticacao.md
-- ============================================================

-- UP

-- ---------------------------------------------------------------------------
-- auth_organizations — Organizações no contexto de autenticação
-- ---------------------------------------------------------------------------
CREATE TABLE auth_organizations (
  id         TEXT        NOT NULL,
  name       TEXT        NOT NULL,
  -- Gerado automaticamente a partir do name (ex: "escola-estadual-sp")
  slug       TEXT,
  logo       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- JSONB serializado como TEXT (padrão Better Auth)
  metadata   TEXT,

  CONSTRAINT auth_organizations_pkey        PRIMARY KEY (id),
  CONSTRAINT auth_organizations_slug_unique UNIQUE (slug)
);

COMMENT ON TABLE  auth_organizations          IS 'Organizações no contexto de autenticação (Better Auth plugin)';
COMMENT ON COLUMN auth_organizations.slug     IS 'Identificador URL-safe único da organização';
COMMENT ON COLUMN auth_organizations.metadata IS 'Metadados JSONB serializados como TEXT (padrão Better Auth)';

-- ---------------------------------------------------------------------------
-- auth_members — Membership de utilizadores em organizações de auth
-- ---------------------------------------------------------------------------
CREATE TABLE auth_members (
  id              TEXT        NOT NULL,
  organization_id TEXT        NOT NULL,
  user_id         TEXT        NOT NULL,
  -- 'admin' | 'professor' | 'rh' | 'student' (ver AccessControl em auth.ts)
  role            TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT auth_members_pkey      PRIMARY KEY (id),
  CONSTRAINT auth_members_org_fkey  FOREIGN KEY (organization_id)
                                      REFERENCES auth_organizations (id) ON DELETE CASCADE,
  CONSTRAINT auth_members_user_fkey FOREIGN KEY (user_id)
                                      REFERENCES auth_users (id) ON DELETE CASCADE
);

COMMENT ON TABLE  auth_members      IS 'Membros de organizações no contexto de autenticação';
COMMENT ON COLUMN auth_members.role IS 'admin | professor | rh | student — alinha com RBAC AccessControl';

-- ---------------------------------------------------------------------------
-- auth_invitations — Convites para ingresso em organização
-- ---------------------------------------------------------------------------
CREATE TABLE auth_invitations (
  id              TEXT        NOT NULL,
  organization_id TEXT        NOT NULL,
  email           TEXT        NOT NULL,
  role            TEXT,
  -- 'pending' | 'accepted' | 'rejected' | 'canceled'
  status          TEXT        NOT NULL DEFAULT 'pending',
  expires_at      TIMESTAMPTZ NOT NULL,
  inviter_id      TEXT        NOT NULL,

  CONSTRAINT auth_invitations_pkey        PRIMARY KEY (id),
  CONSTRAINT auth_invitations_org_fkey    FOREIGN KEY (organization_id)
                                            REFERENCES auth_organizations (id) ON DELETE CASCADE,
  CONSTRAINT auth_invitations_inviter_fkey FOREIGN KEY (inviter_id)
                                             REFERENCES auth_users (id) ON DELETE CASCADE,
  CONSTRAINT auth_invitations_status_check CHECK (
    status IN ('pending', 'accepted', 'rejected', 'canceled')
  )
);

COMMENT ON TABLE  auth_invitations            IS 'Convites pendentes para ingresso numa organização';
COMMENT ON COLUMN auth_invitations.expires_at IS 'Expiração automática do convite (48h recomendado)';

-- ---------------------------------------------------------------------------
-- Índices de suporte
-- ---------------------------------------------------------------------------
CREATE INDEX idx_auth_members_org_id     ON auth_members     (organization_id);
CREATE INDEX idx_auth_members_user_id    ON auth_members     (user_id);
CREATE INDEX idx_auth_invitations_org_id ON auth_invitations (organization_id);
CREATE INDEX idx_auth_invitations_email  ON auth_invitations (email);

-- ---------------------------------------------------------------------------
-- DOWN
-- DROP TABLE IF EXISTS auth_invitations   CASCADE;
-- DROP TABLE IF EXISTS auth_members       CASCADE;
-- DROP TABLE IF EXISTS auth_organizations CASCADE;
-- ---------------------------------------------------------------------------
