#!/bin/sh
psql --set ON_ERROR_STOP=1 --set role="${POSTGRES_SERVICE_USER:?}" --set password="${POSTGRES_SERVICE_PASSWORD:?}" \
    --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
CREATE ROLE :"role" LOGIN PASSWORD :'password';
SQL
