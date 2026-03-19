-- ============================================================
-- VULTRA — Migration 0008
-- Log de auditoria imutável (append-only)
-- Trigger bloqueia UPDATE e DELETE — apenas INSERT é permitido.
-- organization_id sem FK: preserva histórico mesmo após exclusão do tenant.
-- ============================================================

-- UP

CREATE TABLE audit_logs (
  id              BIGSERIAL   NOT NULL,
  organization_id UUID        NOT NULL,   -- Sem FK: imutabilidade histórica garantida
  actor_id        UUID,                   -- NULL = ação do sistema (cron, webhook, etc.)
  actor_type      TEXT        NOT NULL,
  action          TEXT        NOT NULL,   -- Convenção: ENTIDADE_VERBO_PASSADO
  resource_type   TEXT        NOT NULL,   -- Ex: 'attendance_records', 'biometric_profiles'
  resource_id     UUID,
  payload         JSONB       NOT NULL DEFAULT '{}',
  ip_address      INET,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT audit_logs_pkey            PRIMARY KEY (id),
  CONSTRAINT audit_logs_actor_type_check CHECK (actor_type IN ('user', 'device', 'system'))
);

COMMENT ON TABLE  audit_logs               IS 'Log de auditoria imutável — trigger bloqueia UPDATE/DELETE. Apenas INSERT.';
COMMENT ON COLUMN audit_logs.organization_id IS 'Sem FK intencional: preserva o histórico mesmo que o tenant seja excluído';
COMMENT ON COLUMN audit_logs.actor_id      IS 'UUID do usuário ou device. NULL para ações automáticas do sistema';
COMMENT ON COLUMN audit_logs.action        IS 'Convenção: ENTIDADE_VERBO. Ex: ATTENDANCE_RECORD_CREATED, MEMBER_DELETED';
COMMENT ON COLUMN audit_logs.payload       IS 'Snapshot JSONB do estado anterior e/ou posterior do recurso afetado';
COMMENT ON COLUMN audit_logs.ip_address    IS 'Endereço IP de origem da requisição (IPv4 ou IPv6)';

-- ---------------------------------------------------------------------------
-- Trigger de imutabilidade: bloqueia UPDATE e DELETE em tempo de execução
-- Uma trigger no banco é mais robusta do que apenas política de aplicação.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_audit_logs_immutable()
  RETURNS TRIGGER
  LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'audit_logs é imutável. Operação "%" não é permitida — apenas INSERT é aceito.',
    TG_OP;
END;
$$;

CREATE TRIGGER trg_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION enforce_audit_logs_immutable();

-- ---------------------------------------------------------------------------
-- Índices para queries de auditoria paginadas por tenant
-- ---------------------------------------------------------------------------
CREATE INDEX idx_audit_logs_org_created
  ON audit_logs (organization_id, created_at DESC);

CREATE INDEX idx_audit_logs_resource
  ON audit_logs (organization_id, resource_type, resource_id);

CREATE INDEX idx_audit_logs_actor
  ON audit_logs (organization_id, actor_id)
  WHERE actor_id IS NOT NULL;

CREATE INDEX idx_audit_logs_action
  ON audit_logs (organization_id, action);

-- Índice GIN para buscas dentro do payload JSONB (opcional, mas útil para debugging)
CREATE INDEX idx_audit_logs_payload_gin
  ON audit_logs USING GIN (payload);
