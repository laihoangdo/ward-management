#!/usr/bin/env bash
# Temporarily route only OAuth callbacks/API for synthetic testing; always return to maintenance.
set -euo pipefail
umask 077
[[ ${EUID} -eq 0 ]] || exit 1
site=/etc/nginx/sites-enabled/police-bootstrap.conf
previous=/etc/nginx/sites-available/police-identity-staging.conf
[[ $(readlink -f "$site") == "$previous" ]] || { printf '%s\n' 'Unexpected active site; refusing test routing.' >&2; exit 1; }
hosts=/etc/hosts
hosts_backup=$(mktemp /run/police-app-gate-hosts.XXXXXXXX)
cat "$hosts" > "$hosts_backup"
if awk '$1 !~ /^#/ {for (i=2; i<=NF; i++) if ($i=="sunnytech.cloud") found=1} END {exit !found}' "$hosts"; then
    rm -f "$hosts_backup"
    printf '%s\n' 'Existing sunnytech.cloud host mapping found; refusing temporary origin routing.' >&2
    exit 1
fi
cleanup() {
    result=$?
    trap - EXIT HUP INT TERM
    cleanup_failed=0
    ln -sfn "$previous" "$site" || cleanup_failed=1
    nginx -t >/dev/null || cleanup_failed=1
    if (( cleanup_failed == 0 )); then systemctl reload nginx.service || cleanup_failed=1; fi
    if [[ -f "$hosts_backup" ]]; then
        cat "$hosts_backup" > "$hosts" || cleanup_failed=1
        rm -f "$hosts_backup" || cleanup_failed=1
    fi
    if (( result == 0 && cleanup_failed != 0 )); then
        printf '%s\n' 'Application gate cleanup failed; inspect Nginx and /etc/hosts immediately.' >&2
        result=1
    fi
    exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
python3 - <<'PY'
from pathlib import Path
source=Path('/etc/nginx/sites-available/police-identity-staging.conf').read_text()
needle='    location / {\n        default_type text/plain;'
if source.count(needle)!=1:
    raise SystemExit('Expected maintenance location not found uniquely')
locations=''
for route in ['/oauth2/','/login/oauth2/','/api/','/content/','/assets/','/ocr/']:
    body_limit='client_max_body_size 12m; ' if route=='/api/' else ''
    locations+='    location ^~ '+route+' { '+body_limit+'include /etc/nginx/snippets/police-app-gate-proxy.conf; }\n'
Path('/etc/nginx/sites-available/police-app-gate.conf').write_text(source.replace(needle,locations+needle))
PY
ln -sfn /etc/nginx/sites-available/police-app-gate.conf "$site"
nginx -t
systemctl reload nginx.service
# Route this root-only test client to the local TLS origin, not Cloudflare.
# The public route remains restricted to the synthetic staging gate and is
# restored, along with /etc/hosts, by the EXIT trap.
printf '\n127.0.0.1 sunnytech.cloud # temporary police app gate\n' >> "$hosts"
python3 /opt/police-management/staging/test-app-oidc.py
