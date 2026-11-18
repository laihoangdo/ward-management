#!/usr/bin/env bash
set -euo pipefail
password=$(cat /run/secrets/keycloak_database)
[[ "$password" =~ ^[a-f0-9]{64}$ ]] || { printf '%s\n' 'Invalid generated DB credential format' >&2; exit 1; }
# Password sent over stdin, never as a command-line argument or with shell tracing.
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 <<SQL
CREATE ROLE keycloak LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '$password';
CREATE DATABASE keycloak OWNER keycloak TEMPLATE template0;
REVOKE CONNECT ON DATABASE "Monolithic" FROM PUBLIC;
REVOKE CONNECT ON DATABASE keycloak FROM PUBLIC;
GRANT CONNECT ON DATABASE keycloak TO keycloak;
SQL
