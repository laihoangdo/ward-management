#!/usr/bin/env bash
# Short, loopback-only Keycloak master console window for owner MFA enrollment.
set -euo pipefail
umask 077
[[ ${EUID} -eq 0 ]] || { printf '%s\n' 'Run via sudo.' >&2; exit 1; }

site=/etc/nginx/sites-enabled/police-bootstrap.conf
previous=/etc/nginx/sites-available/police-identity-staging.conf
temporary=/etc/nginx/sites-available/police-master-admin-window.conf
compose=/opt/police-management/staging/compose.yml
[[ -L "$site" && $(readlink -f "$site") == "$previous" ]] || {
    printf '%s\n' 'Expected synthetic identity/maintenance site is not active; refusing.' >&2; exit 1;
}
[[ ! -e "$temporary" ]] || { printf '%s\n' 'Temporary admin config already exists; inspect before proceeding.' >&2; exit 1; }
container=$(docker compose -f "$compose" ps --status running --quiet keycloak)
[[ -n "$container" && $(docker inspect --format '{{.State.Health.Status}}' "$container") == healthy ]] || {
    printf '%s\n' 'Keycloak must be healthy before opening the local-only console.' >&2; exit 1;
}

activated=0
cleanup() {
    result=$?
    trap - EXIT HUP INT TERM
    cleanup_failed=0
    if (( activated )); then
        ln -sfn "$previous" "$site" || cleanup_failed=1
        if nginx -t >/dev/null; then
            systemctl reload nginx.service || cleanup_failed=1
        else
            cleanup_failed=1
        fi
    fi
    rm -f "$temporary" || cleanup_failed=1
    if (( cleanup_failed )); then
        printf '%s\n' 'Admin-window cleanup failed; verify maintenance routing immediately.' >&2
        result=1
    fi
    exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

python3 - "$previous" "$temporary" <<'PY'
from pathlib import Path
import sys

source = Path(sys.argv[1]).read_text()
destination = Path(sys.argv[2])
admin_stub = '    location ^~ /admin/ { return 404; }'
needle = '    location ^~ /realms/police-staging/ {'
if source.count(admin_stub) != 1 or source.count(needle) != 1:
    raise SystemExit('Expected maintenance/admin routes were not unique; no config written.')
admin_route = '''    location ^~ /admin/ {
        allow 127.0.0.1;
        deny all;
        include /etc/nginx/snippets/police-staging-identity-proxy.conf;
    }
'''
master_route = '''    location ^~ /realms/master/ {
        allow 127.0.0.1;
        deny all;
        include /etc/nginx/snippets/police-staging-identity-proxy.conf;
    }
'''
with destination.open('x') as output:
    updated = source.replace(admin_stub, admin_route).replace(needle, master_route + needle)
    output.write(updated)
destination.chmod(0o644)
PY

ln -sfn "$temporary" "$site"
activated=1
nginx -t
systemctl reload nginx.service
printf '%s\n' 'Master console is available only from 127.0.0.1 through the SSH tunnel for at most 15 minutes.'
printf '%s\n' 'Press Ctrl-C to restore the normal synthetic staging/maintenance routes sooner.'
sleep 900
