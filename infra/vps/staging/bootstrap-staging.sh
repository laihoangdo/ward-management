#!/usr/bin/env bash
set -euo pipefail
[[ ${EUID} -eq 0 ]] || { printf '%s\n' 'Run via sudo.' >&2; exit 1; }
source_dir=${1:?Pass reviewed staging source directory}
destination=/opt/police-management/staging
[[ ! -e "$destination/compose.yml" ]] || { printf '%s\n' 'Staging already provisioned; review instead of overwriting.' >&2; exit 1; }
for script in keycloak-entrypoint.sh init-identity-db.sh; do bash -n "$source_dir/$script"; done
install -d -m 0755 "$destination"
install -m 0644 "$source_dir/compose.yml" "$source_dir/Keycloak.Dockerfile" "$source_dir/.dockerignore" "$destination/"
install -m 0755 "$source_dir/keycloak-entrypoint.sh" "$source_dir/init-identity-db.sh" "$destination/"
python3 "$source_dir/generate-secrets.py"
cd "$destination"
docker compose config --quiet
docker compose up -d --build --wait --wait-timeout 300
printf '%s\n' 'Synthetic identity staging ready on loopback only. Public proxy is not changed by this script.'
