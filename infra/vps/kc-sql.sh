#!/usr/bin/env bash
# Read/execute SQL against the identity database via stdin; password never appears in argv.
set -euo pipefail
exec docker exec -i police-staging-database-1 bash -c 'export PGPASSWORD="$(cat /run/secrets/database_owner)"; exec psql -X -q -At -h 127.0.0.1 -U Monolithic -v ON_ERROR_STOP=1 -d keycloak'
