-- ============================================================
-- VULTRA — Migration 0014
-- Concretiza a FK lógica members.user_id → auth_users(id)
--
-- A migration 0003 criou members.user_id como UUID nullable sem FK,
-- pois auth_users ainda não existia (gerada neste branch).
-- Agora que auth_users existe (migration 0011), adicionamos a referência.
--
-- ON DELETE SET NULL: remover o utilizador de auth NÃO remove o membro
-- de domínio — necessário para auditoria e conformidade LGPD.
-- ============================================================

-- UP

-- Alterar tipo: members.user_id era UUID, auth_users.id é TEXT
-- UUID é subconjunto válido de TEXT — cast implícito não é necessário,
-- mas a FK exige tipos compatíveis. Alteramos a coluna para TEXT.
ALTER TABLE members
  ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- Adicionar FK: members.user_id → auth_users(id)
ALTER TABLE members
  ADD CONSTRAINT members_auth_user_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth_users (id)
    ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- DOWN
-- ALTER TABLE members DROP CONSTRAINT IF EXISTS members_auth_user_fkey;
-- ALTER TABLE members ALTER COLUMN user_id TYPE UUID USING user_id::UUID;
-- ---------------------------------------------------------------------------
