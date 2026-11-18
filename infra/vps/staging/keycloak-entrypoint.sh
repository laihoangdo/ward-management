#!/usr/bin/env bash
set -euo pipefail
export KC_DB_PASSWORD="$(cat /run/secrets/keycloak_database)"
export KC_BOOTSTRAP_ADMIN_PASSWORD="$(cat /run/secrets/keycloak_bootstrap)"
exec /opt/keycloak/bin/kc.sh "$@"
