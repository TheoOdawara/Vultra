-- ============================================================
-- VULTRA — Migration 0007
-- Registros de presença individual — TABELA PARTICIONADA
--
-- Estratégia: PARTITION BY RANGE (recorded_at) — partições trimestrais
-- Justificativa: volume elevado de writes durante chamadas simultâneas;
--   particionamento permite archiving e DROP de partições antigas sem
--   VACUUM full na tabela inteira.
--
-- IMPORTANTE: Em tabelas particionadas no PostgreSQL 16:
--   - PRIMARY KEY e UNIQUE devem incluir a coluna de partição (recorded_at)
--   - RLS definida no pai é herdada por todas as partições (existentes e futuras)
--   - FKs do pai para tabelas normais são suportadas desde PG 12
-- ============================================================

-- UP

-- ---------------------------------------------------------------------------
-- Tabela pai (não contém dados diretamente — apenas metadados e constraints)
-- ---------------------------------------------------------------------------
CREATE TABLE attendance_records (
  id                 UUID        NOT NULL DEFAULT gen_uuid_v7(),
  organization_id    UUID        NOT NULL,
  session_id         UUID        NOT NULL,
  member_id          UUID        NOT NULL,
  recorded_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),    -- coluna de partição
  confidence_score   REAL        NOT NULL,
  match_threshold    REAL        NOT NULL DEFAULT 0.85,
  recognition_method TEXT        NOT NULL DEFAULT 'face',
  sentiment_label    TEXT,                                  -- happy|neutral|sad|angry|surprise|fear|disgust
  sentiment_score    REAL,                                  -- Score do sentimento dominante [0, 1]
  is_manual          BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- PK COMPOSTA: obrigatório incluir recorded_at (coluna de partição)
  CONSTRAINT attendance_records_pkey               PRIMARY KEY (id, recorded_at),

  -- UNIQUE COMPOSTA: impede duplicata por sessão/membro (HTTP 409)
  -- recorded_at incluído por ser coluna de partição
  CONSTRAINT attendance_records_session_member_key UNIQUE (session_id, member_id, recorded_at),

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

) PARTITION BY RANGE (recorded_at);

COMMENT ON TABLE  attendance_records                    IS 'Registros de presença individual — particionado trimestralmente por recorded_at';
COMMENT ON COLUMN attendance_records.confidence_score   IS 'Similaridade cosseno [0,1] retornada pelo AI Service no momento do match';
COMMENT ON COLUMN attendance_records.match_threshold    IS 'Snapshot do threshold vigente no match — para auditoria de falsos positivos';
COMMENT ON COLUMN attendance_records.sentiment_label    IS 'Sentimento dominante detectado pelo DeepFace (opcional)';
COMMENT ON COLUMN attendance_records.recognition_method IS 'face = reconhecimento facial automático; manual = inserção manual pelo professor';
COMMENT ON COLUMN attendance_records.is_manual          IS 'TRUE quando inserido manualmente pelo professor via interface';

-- ---------------------------------------------------------------------------
-- Partições trimestrais — 2025 (histórico) até Q2 2027
-- Gerenciar novas partições com script/pg_cron antes de cada trimestre.
-- ---------------------------------------------------------------------------
CREATE TABLE attendance_records_2025_q1 PARTITION OF attendance_records
  FOR VALUES FROM ('2025-01-01 00:00:00+00') TO ('2025-04-01 00:00:00+00');

CREATE TABLE attendance_records_2025_q2 PARTITION OF attendance_records
  FOR VALUES FROM ('2025-04-01 00:00:00+00') TO ('2025-07-01 00:00:00+00');

CREATE TABLE attendance_records_2025_q3 PARTITION OF attendance_records
  FOR VALUES FROM ('2025-07-01 00:00:00+00') TO ('2025-10-01 00:00:00+00');

CREATE TABLE attendance_records_2025_q4 PARTITION OF attendance_records
  FOR VALUES FROM ('2025-10-01 00:00:00+00') TO ('2026-01-01 00:00:00+00');

CREATE TABLE attendance_records_2026_q1 PARTITION OF attendance_records
  FOR VALUES FROM ('2026-01-01 00:00:00+00') TO ('2026-04-01 00:00:00+00');

CREATE TABLE attendance_records_2026_q2 PARTITION OF attendance_records
  FOR VALUES FROM ('2026-04-01 00:00:00+00') TO ('2026-07-01 00:00:00+00');

CREATE TABLE attendance_records_2026_q3 PARTITION OF attendance_records
  FOR VALUES FROM ('2026-07-01 00:00:00+00') TO ('2026-10-01 00:00:00+00');

CREATE TABLE attendance_records_2026_q4 PARTITION OF attendance_records
  FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');

CREATE TABLE attendance_records_2027_q1 PARTITION OF attendance_records
  FOR VALUES FROM ('2027-01-01 00:00:00+00') TO ('2027-04-01 00:00:00+00');

CREATE TABLE attendance_records_2027_q2 PARTITION OF attendance_records
  FOR VALUES FROM ('2027-04-01 00:00:00+00') TO ('2027-07-01 00:00:00+00');

-- Partição padrão: captura datas fora do range acima (evita erros em prod)
CREATE TABLE attendance_records_overflow PARTITION OF attendance_records DEFAULT;

-- ---------------------------------------------------------------------------
-- Índices B-Tree compostos — tenant-first, aplicados na tabela pai
-- O PostgreSQL propaga automaticamente para todas as partições
-- ---------------------------------------------------------------------------
CREATE INDEX idx_attendance_records_org_date
  ON attendance_records (organization_id, recorded_at DESC);

CREATE INDEX idx_attendance_records_session
  ON attendance_records (session_id, recorded_at);

CREATE INDEX idx_attendance_records_member_date
  ON attendance_records (organization_id, member_id, recorded_at DESC);

CREATE INDEX idx_attendance_records_method
  ON attendance_records (organization_id, recognition_method, recorded_at DESC);

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- Políticas no pai são herdadas por TODAS as partições (existentes e futuras)
-- ---------------------------------------------------------------------------
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
