-- ============================================================
-- VULTRA — Migration 0013
-- Better Auth plugin Passkey (WebAuthn / FIDO2)
--
-- Armazena credenciais passkey vinculadas ao utilizador.
-- Compatível com autenticadores: Touch ID, Face ID, YubiKey, etc.
-- ============================================================

-- UP

-- ---------------------------------------------------------------------------
-- auth_passkeys — Credenciais WebAuthn (FIDO2) por utilizador
-- ---------------------------------------------------------------------------
CREATE TABLE auth_passkeys (
  id              TEXT        NOT NULL,
  name            TEXT,                    -- Nome amigável dado pelo utilizador
  public_key      TEXT        NOT NULL,    -- Chave pública em formato COSE (base64url)
  user_id         TEXT        NOT NULL,
  webauthn_user_id TEXT       NOT NULL,    -- ID de utilizador WebAuthn (base64url)
  counter         INTEGER     NOT NULL,    -- Contador de utilização (replay attack protection)
  -- 'singleDevice' | 'multiDevice'
  device_type     TEXT        NOT NULL,
  backed_up       BOOLEAN     NOT NULL,    -- TRUE = sincronizado com cloud do SO
  -- CSV: 'usb' | 'ble' | 'nfc' | 'internal' | 'hybrid'
  transports      TEXT,
  aaguid          TEXT,                    -- Identificador do modelo de autenticador
  created_at      TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT auth_passkeys_pkey        PRIMARY KEY (id),
  CONSTRAINT auth_passkeys_user_fkey   FOREIGN KEY (user_id)
                                         REFERENCES auth_users (id) ON DELETE CASCADE,
  CONSTRAINT auth_passkeys_device_check CHECK (
    device_type IN ('singleDevice', 'multiDevice')
  )
);

COMMENT ON TABLE  auth_passkeys               IS 'Credenciais WebAuthn/FIDO2 por utilizador (plugin Passkey)';
COMMENT ON COLUMN auth_passkeys.public_key    IS 'Chave pública COSE em base64url — NUNCA chave privada';
COMMENT ON COLUMN auth_passkeys.counter       IS 'Contador monotónico — incrementado a cada uso (anti-replay)';
COMMENT ON COLUMN auth_passkeys.backed_up     IS 'TRUE = passkey sincronizado com Keychain/Google Password Manager';
COMMENT ON COLUMN auth_passkeys.transports    IS 'Transportes suportados: usb, ble, nfc, internal, hybrid (CSV)';

-- ---------------------------------------------------------------------------
-- Índices de suporte
-- ---------------------------------------------------------------------------
CREATE INDEX idx_auth_passkeys_user_id ON auth_passkeys (user_id);

-- ---------------------------------------------------------------------------
-- DOWN
-- DROP TABLE IF EXISTS auth_passkeys CASCADE;
-- ---------------------------------------------------------------------------
