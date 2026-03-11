-- ============================================================
-- VULTRA — Migration 0001
-- Extensões PostgreSQL + funções utilitárias globais
-- ============================================================

-- UP
BEGIN;

-- ---------------------------------------------------------------------------
-- Extensões obrigatórias (idempotentes)
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- uuid_generate_v4() (compatibilidade)
CREATE EXTENSION IF NOT EXISTS "vector";      -- pgvector: tipo VECTOR(N), operadores <=>, <->
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- Busca trigrama para nomes/matrículas
CREATE EXTENSION IF NOT EXISTS "btree_gin";   -- Índices GIN compostos em JSONB

-- ---------------------------------------------------------------------------
-- gen_uuid_v7()
-- Gera UUIDs versão 7 conforme RFC 9562.
-- Vantagem sobre v4: 48-bit timestamp ms no prefixo garante ordenação temporal
-- natural nos índices B-Tree — melhor performance de INSERT em tabelas grandes.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION gen_uuid_v7()
  RETURNS UUID
  LANGUAGE plpgsql
  VOLATILE
AS $$
DECLARE
  v_unix_ms BIGINT;
  v_b       BYTEA;
BEGIN
  v_unix_ms := FLOOR(EXTRACT(EPOCH FROM CLOCK_TIMESTAMP()) * 1000)::BIGINT;
  v_b       := gen_random_bytes(16);

  -- Overlay 48-bit unix timestamp nos bytes 0-5
  v_b := SET_BYTE(v_b, 0, (v_unix_ms >> 40) & x'ff'::int);
  v_b := SET_BYTE(v_b, 1, (v_unix_ms >> 32) & x'ff'::int);
  v_b := SET_BYTE(v_b, 2, (v_unix_ms >> 24) & x'ff'::int);
  v_b := SET_BYTE(v_b, 3, (v_unix_ms >> 16) & x'ff'::int);
  v_b := SET_BYTE(v_b, 4, (v_unix_ms >>  8) & x'ff'::int);
  v_b := SET_BYTE(v_b, 5,  v_unix_ms        & x'ff'::int);

  -- Byte 6: versão = 7 → bits 0111xxxx
  v_b := SET_BYTE(v_b, 6, (GET_BYTE(v_b, 6) & x'0f'::int) | x'70'::int);

  -- Byte 8: variante RFC 4122 → bits 10xxxxxx
  v_b := SET_BYTE(v_b, 8, (GET_BYTE(v_b, 8) & x'3f'::int) | x'80'::int);

  RETURN encode(v_b, 'hex')::UUID;
END;
$$;

-- ---------------------------------------------------------------------------
-- set_updated_at()
-- Trigger function compartilhada: atualiza `updated_at` automaticamente
-- em operações UPDATE em todas as tabelas com esse campo.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

COMMIT;

-- DOWN
BEGIN;
DROP FUNCTION IF EXISTS set_updated_at();
DROP FUNCTION IF EXISTS gen_uuid_v7();
DROP EXTENSION IF EXISTS "btree_gin";
DROP EXTENSION IF EXISTS "pg_trgm";
DROP EXTENSION IF EXISTS "vector";
DROP EXTENSION IF EXISTS "uuid-ossp";
COMMIT;
