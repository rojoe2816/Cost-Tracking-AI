#!/bin/bash
# Creates the dedicated LiteLLM internal database.
#
# This script runs automatically via /docker-entrypoint-initdb.d ONLY when
# the postgres_data volume is initialized for the first time. If you already
# have a volume from an earlier setup, create the database manually:
#
#   docker compose exec postgres psql -U postgres -c "CREATE DATABASE litellm;"
#
# Keeping LiteLLM's tables out of cost_tracking_ai means `prisma db push`
# never manages or drops LiteLLM internals.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-'EOSQL'
	SELECT 'CREATE DATABASE litellm'
	WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'litellm')\gexec
EOSQL
