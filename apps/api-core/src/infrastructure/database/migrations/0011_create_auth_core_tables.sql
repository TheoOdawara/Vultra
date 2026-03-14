-- ============================================================
-- VULTRA — Migration 0011
-- Better Auth: tabelas core de autenticação
--
-- Prefixo `auth_` em todas as tabelas para evitar colisão com
-- as tabelas de domínio (`organizations`, `members`, etc.).
-- Sem RLS — Better Auth gerencia acesso internamente via sessão.
-- ============================================================

-- UP

-- ---------------------------------------------------------------------------
-- auth_users — Utilizadores autenticados (identidade digital)
-- ---------------------------------------------------------------------------
CREATE TABLE auth_users (
  id             TEXT        NOT NULL,
  name           TEXT        NOT NULL,
  email          TEXT        NOT NULL,
  email_verified BOOLEAN     NOT NULL DEFAULT FALSE,
  image          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT auth_users_pkey         PRIMARY KEY (id),
  CONSTRAINT auth_users_email_unique UNIQUE (email)
);

COMMENT ON TABLE  auth_users                IS 'Identidades de utilizadores geridas pelo Better Auth';
COMMENT ON COLUMN auth_users.email_verified IS 'TRUE após verificação de e-mail via link/OTP';
COMMENT ON COLUMN auth_users.image          IS 'URL do avatar (OAuth provider ou upload manual)';

-- ---------------------------------------------------------------------------
-- auth_sessions — Sessões ativas (token opaco HMAC)
-- ---------------------------------------------------------------------------
CREATE TABLE auth_sessions (
  id          TEXT        NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  token       TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address  TEXT,
  user_agent  TEXT,
  user_id     TEXT        NOT NULL,

  CONSTRAINT auth_sessions_pkey         PRIMARY KEY (id),
  CONSTRAINT auth_sessions_token_unique UNIQUE (token),
  CONSTRAINT auth_sessions_user_fkey    FOREIGN KEY (user_id)
                                          REFERENCES auth_users (id) ON DELETE CASCADE
);

COMMENT ON TABLE  auth_sessions            IS 'Sessões ativas por utilizador (multiSession: máx. 3 por utilizador)';
COMMENT ON COLUMN auth_sessions.token      IS 'Token HMAC opaco enviado no cookie de sessão';
COMMENT ON COLUMN auth_sessions.ip_address IS 'IP de origem da sessão (logging LGPD)';

-- ---------------------------------------------------------------------------
-- auth_accounts — Credenciais por provider (email/pass, OAuth, passkey, etc.)
-- ---------------------------------------------------------------------------
CREATE TABLE auth_accounts (
  id                        TEXT        NOT NULL,
  account_id                TEXT        NOT NULL,
  provider_id               TEXT        NOT NULL,
  user_id                   TEXT        NOT NULL,
  access_token              TEXT,
  refresh_token             TEXT,
  id_token                  TEXT,
  access_token_expires_at   TIMESTAMPTZ,
  refresh_token_expires_at  TIMESTAMPTZ,
  scope                     TEXT,
  -- Hash bcrypt da senha (provider 'credential'). NUNCA plaintext.
  password                  TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT auth_accounts_pkey      PRIMARY KEY (id),
  CONSTRAINT auth_accounts_user_fkey FOREIGN KEY (user_id)
                                       REFERENCES auth_users (id) ON DELETE CASCADE
);

COMMENT ON TABLE  auth_accounts          IS 'Credenciais vinculadas a um utilizador por provider';
COMMENT ON COLUMN auth_accounts.password IS 'Hash bcrypt da senha — NUNCA armazenar plaintext';

-- ---------------------------------------------------------------------------
-- auth_verifications — Tokens de verificação temporários (e-mail, OTP, etc.)
-- ---------------------------------------------------------------------------
CREATE TABLE auth_verifications (
  id          TEXT        NOT NULL,
  identifier  TEXT        NOT NULL,
  value       TEXT        NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT auth_verifications_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE  auth_verifications            IS 'Tokens temporários para verificação de e-mail, reset de senha, etc.';
COMMENT ON COLUMN auth_verifications.identifier IS 'Identificador da verificação (ex: endereço de e-mail)';
COMMENT ON COLUMN auth_verifications.value      IS 'Token HMAC ou OTP hashed';

-- ---------------------------------------------------------------------------
-- Índices de suporte
-- ---------------------------------------------------------------------------
CREATE INDEX idx_auth_sessions_user_id    ON auth_sessions    (user_id);
CREATE INDEX idx_auth_sessions_expires_at ON auth_sessions    (expires_at);
CREATE INDEX idx_auth_accounts_user_id    ON auth_accounts    (user_id);
CREATE INDEX idx_auth_accounts_provider   ON auth_accounts    (provider_id, account_id);

-- ---------------------------------------------------------------------------
-- DOWN
-- DROP TABLE IF EXISTS auth_verifications CASCADE;
-- DROP TABLE IF EXISTS auth_accounts      CASCADE;
-- DROP TABLE IF EXISTS auth_sessions      CASCADE;
-- DROP TABLE IF EXISTS auth_users         CASCADE;
-- ---------------------------------------------------------------------------
