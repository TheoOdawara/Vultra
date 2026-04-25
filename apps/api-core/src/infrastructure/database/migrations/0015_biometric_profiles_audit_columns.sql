-- ============================================================
-- VULTRA — Migration 0015
-- biometric_profiles: colunas adicionais de auditoria e deleção LGPD
-- ============================================================

-- UP

ALTER TABLE biometric_profiles
  ADD COLUMN IF NOT EXISTS device_id UUID,
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID;

ALTER TABLE biometric_profiles
  ALTER COLUMN face_embedding DROP NOT NULL;

COMMENT ON COLUMN biometric_profiles.device_id
  IS 'Identificador do dispositivo de captura associado ao enroll, quando aplicável.';

COMMENT ON COLUMN biometric_profiles.created_by
  IS 'Identificador UUID do ator que criou o perfil biométrico.';

COMMENT ON COLUMN biometric_profiles.deleted_at
  IS 'Timestamp de revogação/soft-delete LGPD. Em revoke final, face_embedding deve permanecer NULL.';

COMMENT ON COLUMN biometric_profiles.deleted_by
  IS 'Identificador UUID do ator que executou a revogação/soft-delete LGPD.';

-- ---------------------------------------------------------------------------
-- DOWN
-- ALTER TABLE biometric_profiles ALTER COLUMN face_embedding SET NOT NULL;
-- ALTER TABLE biometric_profiles
--   DROP COLUMN IF EXISTS deleted_by,
--   DROP COLUMN IF EXISTS deleted_at,
--   DROP COLUMN IF EXISTS created_by,
--   DROP COLUMN IF EXISTS device_id;
-- ---------------------------------------------------------------------------
