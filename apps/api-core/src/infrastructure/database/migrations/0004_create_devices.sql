-- ============================================================
-- VULTRA — Migration 0004
-- Dispositivos ESP32-CAM registrados por tenant
-- Auth IoT: X-Device-Token validado via api_key_hash (bcrypt)
-- ============================================================

-- UP
BEGIN;

CREATE TABLE devices (
  id               UUID        NOT NULL DEFAULT gen_uuid_v7(),
  organization_id  UUID        NOT NULL,
  api_key_hash     TEXT        NOT NULL,        -- Hash bcrypt do X-Device-Token
  label            TEXT        NOT NULL,        -- Ex: 'CAM-SALA-101'
  location         TEXT,                        -- Descrição do local físico
  firmware_version TEXT,
  last_seen_at     TIMESTAMPTZ,                 -- Último heartbeat recebido
  is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT devices_pkey         PRIMARY KEY (id),
  CONSTRAINT devices_org_fkey     FOREIGN KEY (organization_id)
                                    REFERENCES organizations (id) ON DELETE RESTRICT,
  -- api_key_hash é globalmente único: impede reutilização de tokens entre tenants
  CONSTRAINT devices_api_key_hash UNIQUE (api_key_hash)
);

COMMENT ON TABLE  devices              IS 'Dispositivos ESP32-CAM registrados: cada device pertence a um único tenant';
COMMENT ON COLUMN devices.api_key_hash IS 'Hash bcrypt do X-Device-Token. NUNCA armazenar o token em plaintext';
COMMENT ON COLUMN devices.label        IS 'Identificador legível por humanos. Ex: CAM-SALA-101, CAM-ENTRADA-RH';
COMMENT ON COLUMN devices.last_seen_at IS 'Atualizado a cada heartbeat do firmware — usado para monitoramento de saúde';

-- Índices B-Tree compostos
CREATE INDEX idx_devices_org_id
  ON devices (organization_id);

CREATE INDEX idx_devices_org_active
  ON devices (organization_id, is_active)
  WHERE is_active = TRUE;

-- Trigger: updated_at automático
CREATE TRIGGER trg_devices_updated_at
  BEFORE UPDATE ON devices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Row-Level Security
ALTER TABLE devices ENABLE  ROW LEVEL SECURITY;
ALTER TABLE devices FORCE   ROW LEVEL SECURITY;

CREATE POLICY devices_tenant_isolation ON devices
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
DROP POLICY  IF EXISTS devices_tenant_isolation   ON devices;
DROP TRIGGER IF EXISTS trg_devices_updated_at     ON devices;
DROP TABLE   IF EXISTS devices;
COMMIT;
