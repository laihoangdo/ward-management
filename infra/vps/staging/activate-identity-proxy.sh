#!/usr/bin/env bash
set -euo pipefail
[[ ${EUID} -eq 0 ]] || { printf '%s\n' 'Run via sudo.' >&2; exit 1; }
source_dir=${1:?Pass reviewed staging source directory}
site=/etc/nginx/sites-enabled/police-bootstrap.conf
previous=/etc/nginx/sites-available/police-https-maintenance.conf
[[ -L "$site" && $(readlink -f "$site") == "$previous" ]] || {
    printf '%s\n' 'Expected maintenance site missing; do not overwrite unreviewed routing.' >&2; exit 1;
}
container=$(docker compose -f /opt/police-management/staging/compose.yml ps --status running --quiet keycloak)
[[ -n "$container" && $(docker inspect --format '{{.State.Health.Status}}' "$container") == healthy ]] || {
    printf '%s\n' 'Identity service must be healthy before publishing.' >&2; exit 1;
}
install -m 0644 "$source_dir/nginx-identity-proxy.conf" /etc/nginx/snippets/police-staging-identity-proxy.conf
install -m 0644 "$source_dir/nginx-identity-staging.conf" /etc/nginx/sites-available/police-identity-staging.conf
ln -sfn /etc/nginx/sites-available/police-identity-staging.conf "$site"
if ! nginx -t; then
    ln -sfn "$previous" "$site"
    printf '%s\n' 'Invalid identity config; maintenance symlink restored without reload.' >&2
    exit 1
fi
systemctl reload nginx.service
printf '%s\n' 'Only the synthetic realm and login resources are public. Application remains in maintenance.'
