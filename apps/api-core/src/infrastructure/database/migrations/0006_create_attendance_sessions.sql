-- ============================================================
-- VULTRA — Migration 0006
-- Sessões de chamada abertas por dispositivo ESP32-CAM
-- ============================================================

-- UP

CREATE TABLE attendance_sessions (
  id              UUID        NOT NULL DEFAULT gen_uuid_v7(),
  organization_id UUID        NOT NULL,
  class_id        UUID,                         -- NULL = check-in corporativo (RH)
  device_id       UUID        NOT NULL,
  professor_id    UUID,                         -- FK lógica para members(role='professor')
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at        TIMESTAMPTZ,
  status          TEXT        NOT NULL DEFAULT 'open',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT attendance_sessions_pkey          PRIMARY KEY (id),
  CONSTRAINT attendance_sessions_org_fkey      FOREIGN KEY (organization_id)
                                                 REFERENCES organizations (id) ON DELETE RESTRICT,
  CONSTRAINT attendance_sessions_device_fkey   FOREIGN KEY (device_id)
                                                 REFERENCES devices (id) ON DELETE RESTRICT,
  -- professor_id é FK lógica (não enforçada pelo banco para evitar ciclo de dependência
  -- com member soft-delete). Enforçada na camada de aplicação.
  CONSTRAINT attendance_sessions_status_check  CHECK (status IN ('open', 'closed', 'cancelled')),
  -- Um dispositivo só pode ter UMA sessão aberta simultânea
  -- (enforçado via índice parcial abaixo, não por constraint de tabela)
  CONSTRAINT attendance_sessions_dates_check   CHECK (ended_at IS NULL OR ended_at > started_at)
);

COMMENT ON TABLE  attendance_sessions               IS 'Sessões de chamada iniciadas por um dispositivo ESP32-CAM';
COMMENT ON COLUMN attendance_sessions.class_id      IS 'NULL = check-in corporativo (RH). Preenchido = chamada em aula';
COMMENT ON COLUMN attendance_sessions.professor_id  IS 'UUID do membro com role=professor (FK lógica, não enforçada pelo banco)';
COMMENT ON COLUMN attendance_sessions.status        IS 'open = em andamento; closed = encerrada; cancelled = cancelada';

-- Índice parcial: garante que um device só tenha UMA sessão status=open por vez
CREATE UNIQUE INDEX idx_attendance_sessions_device_open
  ON attendance_sessions (device_id)
  WHERE status = 'open';

-- Índices B-Tree compostos
CREATE INDEX idx_attendance_sessions_org_id
  ON attendance_sessions (organization_id);

CREATE INDEX idx_attendance_sessions_org_started
  ON attendance_sessions (organization_id, started_at DESC);

CREATE INDEX idx_attendance_sessions_device_id
  ON attendance_sessions (device_id);

CREATE INDEX idx_attendance_sessions_org_status
  ON attendance_sessions (organization_id, status);

-- Trigger: updated_at automático
CREATE TRIGGER trg_attendance_sessions_updated_at
  BEFORE UPDATE ON attendance_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Row-Level Security
ALTER TABLE attendance_sessions ENABLE  ROW LEVEL SECURITY;
ALTER TABLE attendance_sessions FORCE   ROW LEVEL SECURITY;

CREATE POLICY attendance_sessions_tenant_isolation ON attendance_sessions
  AS PERMISSIVE FOR ALL
  TO PUBLIC
  USING (
    organization_id = NULLIF(current_setting('app.current_org_id', TRUE), '')::UUID
  )
  WITH CHECK (
    organization_id = NULLIF(current_setting('app.current_org_id', TRUE), '')::UUID
  );
