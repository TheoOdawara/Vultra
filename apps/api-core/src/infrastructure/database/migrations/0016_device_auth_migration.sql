-- ============================================================
-- VULTRA — Migration 0016
-- Migração de auth de devices para Better Auth API Keys
--
-- 1. Cria auth_apikeys para o plugin @better-auth/api-key
--    (table name = "auth_apikeys" conforme mapeamento em auth.ts)
-- 2. Remove api_key_hash da tabela devices
--    (credenciais agora vivem em auth_apikeys, sem RLS)
--
-- SEM RLS: tabela auth_*, acesso gerido pelo Better Auth.
-- Sem FK para devices (permite revogação independente).
-- ============================================================

-- UP

-- ---------------------------------------------------------------------------
-- auth_apikeys — API Keys geridas pelo @better-auth/api-key plugin
-- ---------------------------------------------------------------------------
CREATE TABLE auth_apikeys (
  id                    TEXT        NOT NULL,
  config_id             TEXT        NOT NULL DEFAULT 'default',
  name                  TEXT,
  -- Primeiros N chars da key para display (não usado em autenticação)
  start                 TEXT,
  -- ID do owner: organizationId para device keys (org-owned)
  reference_id          TEXT        NOT NULL,
  prefix                TEXT,
  -- Chave SHA-256 hashed em base64url. NUNCA armazenar plaintext.
  key                   TEXT        NOT NULL,
  refill_interval       INTEGER,
  refill_amount         INTEGER,
  last_refill_at        TIMESTAMPTZ,
  enabled               BOOLEAN     NOT NULL DEFAULT TRUE,
  rate_limit_enabled    BOOLEAN     NOT NULL DEFAULT TRUE,
  rate_limit_time_window INTEGER,
  rate_limit_max        INTEGER,
  request_count         INTEGER     NOT NULL DEFAULT 0,
  remaining             INTEGER,
  last_request          TIMESTAMPTZ,
  expires_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  permissions           TEXT,
  -- JSON serializado: { "deviceId": "<uuid>" } para device keys
  metadata              TEXT,

  CONSTRAINT auth_apikeys_pkey      PRIMARY KEY (id),
  CONSTRAINT auth_apikeys_key_unique UNIQUE (key)
);

CREATE INDEX idx_auth_apikeys_reference_id ON auth_apikeys (reference_id);
CREATE INDEX idx_auth_apikeys_config_id    ON auth_apikeys (config_id);

COMMENT ON TABLE  auth_apikeys                IS 'API Keys geridas pelo plugin @better-auth/api-key. Sem RLS.';
COMMENT ON COLUMN auth_apikeys.reference_id   IS 'organization_id para device keys (references: "organization")';
COMMENT ON COLUMN auth_apikeys.key            IS 'SHA-256/base64url da plaintext key. NUNCA armazenar plaintext.';
COMMENT ON COLUMN auth_apikeys.metadata       IS 'JSON: { "deviceId": "<uuid>" } para rastrear qual device usa a key';
COMMENT ON COLUMN auth_apikeys.start          IS 'Primeiros 6 chars da key para exibição na UI (ex: "vk_abc1")';

-- ---------------------------------------------------------------------------
-- devices — remover credencial da tabela de domínio
-- A coluna api_key_hash não é mais necessária: credenciais vivem em auth_apikeys
-- ---------------------------------------------------------------------------
ALTER TABLE devices DROP COLUMN IF EXISTS api_key_hash;

-- ---------------------------------------------------------------------------
-- DOWN
-- ALTER TABLE devices ADD COLUMN api_key_hash TEXT NOT NULL DEFAULT '';
-- DROP TABLE IF EXISTS auth_apikeys;
-- ---------------------------------------------------------------------------
