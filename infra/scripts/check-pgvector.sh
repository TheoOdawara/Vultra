#!/usr/bin/env sh
# =============================================================================
# VULTRA — Smoke test: versão pinada do pgvector
#
# Garante que a versão do pgvector entregue pelo container é EXATAMENTE a
# pinada no docker-compose.yml. Reprodutibilidade dos experimentos da IC
# (comportamento do HNSW e do iterative_scan) depende disso — ver
# docs/database/adrs/ADR-002-pin-pgvector-0.8.md.
#
# Uso (com a stack de infra/docker-compose.yml no ar):
#   sh infra/scripts/check-pgvector.sh
#
# Sai com código != 0 se a versão disponível ou instalada divergir do pin.
# =============================================================================
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
COMPOSE_FILE="$SCRIPT_DIR/../docker-compose.yml"

EXPECTED=$(sed -n 's|.*image: *pgvector/pgvector:\([0-9][0-9.]*\)-pg16.*|\1|p' "$COMPOSE_FILE")
if [ -z "$EXPECTED" ]; then
  echo "ERRO: não encontrei uma tag pinada 'pgvector/pgvector:<X.Y.Z>-pg16' em $COMPOSE_FILE" >&2
  echo "      A imagem do postgres precisa estar pinada em versão exata (sem tag flutuante)." >&2
  exit 1
fi

run_sql() {
  docker compose -f "$COMPOSE_FILE" exec -T postgres \
    sh -c "psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -tA -c \"$1\"" | tr -d '[:space:]'
}

AVAILABLE=$(run_sql "SELECT default_version FROM pg_available_extensions WHERE name = 'vector'") || {
  echo "ERRO: não consegui consultar o container 'postgres'. A stack está no ar?" >&2
  echo "      docker compose -f infra/docker-compose.yml up -d postgres" >&2
  exit 1
}

if [ "$AVAILABLE" != "$EXPECTED" ]; then
  echo "FALHA: imagem entrega pgvector $AVAILABLE, mas o pin em docker-compose.yml é $EXPECTED." >&2
  echo "       Recrie o container: docker compose -f infra/docker-compose.yml up -d --force-recreate postgres" >&2
  exit 1
fi

INSTALLED=$(run_sql "SELECT COALESCE((SELECT extversion FROM pg_extension WHERE extname = 'vector'), '')")

if [ -z "$INSTALLED" ]; then
  echo "OK: imagem entrega pgvector $EXPECTED (pin confere)."
  echo "AVISO: a extensão ainda não foi instalada neste banco — rode a migration 0001."
  exit 0
fi

if [ "$INSTALLED" != "$EXPECTED" ]; then
  echo "FALHA: extensão instalada no banco é $INSTALLED, mas o pin é $EXPECTED." >&2
  echo "       Atualize com: ALTER EXTENSION vector UPDATE;" >&2
  echo "       (e reavalie se índices HNSW existentes precisam de REINDEX)" >&2
  exit 1
fi

echo "OK: pgvector $INSTALLED instalado e igual ao pin ($EXPECTED)."
