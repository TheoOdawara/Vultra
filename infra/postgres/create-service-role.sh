#!/bin/sh
psql --set ON_ERROR_STOP=1 --set password="${SERVICE_DATABASE_PASSWORD:?}" \
    --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
CREATE ROLE vultra_service LOGIN PASSWORD :'password';
SQL
