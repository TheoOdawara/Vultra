-- ============================================================
-- VULTRA — Migration 0010
-- Simplifica attendance_records: remove particionamento trimestral.
--
-- Motivação: particionamento é over-engineering para a fase atual.
-- Exigiria criação manual/agendada de partições por trimestre em prod.
-- A tabela simples suporta volumes suficientes para o escopo do projeto.
-- ============================================================

-- Drop da tabela pai CASCADE elimina todas as partições filhas automaticamente
DROP TABLE IF EXISTS attendance_records CASCADE;

CREATE TABLE attendance_records (
  id                 UUID        NOT NULL DEFAULT gen_uuid_v7(),
  organization_id    UUID        NOT NULL,
  session_id         UUID        NOT NULL,
  member_id          UUID        NOT NULL,
  recorded_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confidence_score   REAL        NOT NULL,
  match_threshold    REAL        NOT NULL DEFAULT 0.85,
  recognition_method TEXT        NOT NULL DEFAULT 'face',
  sentiment_label    TEXT,
  sentiment_score    REAL,
  is_manual          BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT attendance_records_pkey               PRIMARY KEY (id),
  CONSTRAINT attendance_records_session_member_key UNIQUE (session_id, member_id),
  CONSTRAINT attendance_records_session_fkey       FOREIGN KEY (session_id)
                                                     REFERENCES attendance_sessions (id) ON DELETE RESTRICT,
  CONSTRAINT attendance_records_member_fkey        FOREIGN KEY (member_id)
                                                     REFERENCES members (id) ON DELETE RESTRICT,

  CONSTRAINT attendance_records_confidence_check   CHECK (confidence_score   BETWEEN 0.0 AND 1.0),
  CONSTRAINT attendance_records_threshold_check    CHECK (match_threshold    BETWEEN 0.0 AND 1.0),
  CONSTRAINT attendance_records_method_check       CHECK (recognition_method IN ('face', 'manual')),
  CONSTRAINT attendance_records_sentiment_check    CHECK (
    sentiment_score IS NULL OR sentiment_score BETWEEN 0.0 AND 1.0
  )
);

COMMENT ON TABLE  attendance_records                    IS 'Registros de presença individual por sessão';
COMMENT ON COLUMN attendance_records.confidence_score   IS 'Similaridade cosseno [0,1] retornada pelo AI Service no momento do match';
COMMENT ON COLUMN attendance_records.match_threshold    IS 'Snapshot do threshold vigente no match — para auditoria de falsos positivos';
COMMENT ON COLUMN attendance_records.sentiment_label    IS 'Sentimento dominante detectado pelo DeepFace (opcional)';
COMMENT ON COLUMN attendance_records.recognition_method IS 'face = reconhecimento facial automático; manual = inserção manual pelo professor';
COMMENT ON COLUMN attendance_records.is_manual          IS 'TRUE quando inserido manualmente pelo professor via interface';

CREATE INDEX idx_attendance_records_org_date
  ON attendance_records (organization_id, recorded_at DESC);

CREATE INDEX idx_attendance_records_session
  ON attendance_records (session_id);

CREATE INDEX idx_attendance_records_member_date
  ON attendance_records (organization_id, member_id, recorded_at DESC);

CREATE INDEX idx_attendance_records_method
  ON attendance_records (organization_id, recognition_method, recorded_at DESC);

ALTER TABLE attendance_records ENABLE  ROW LEVEL SECURITY;
ALTER TABLE attendance_records FORCE   ROW LEVEL SECURITY;

CREATE POLICY attendance_records_tenant_isolation ON attendance_records
  AS PERMISSIVE FOR ALL
  TO PUBLIC
  USING (
    organization_id = NULLIF(current_setting('app.current_org_id', TRUE), '')::UUID
  )
  WITH CHECK (
    organization_id = NULLIF(current_setting('app.current_org_id', TRUE), '')::UUID
  );
