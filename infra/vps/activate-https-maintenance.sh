#!/usr/bin/env bash
set -euo pipefail
[[ ${EUID} -eq 0 ]] || { printf '%s\n' 'Run via sudo.' >&2; exit 1; }
source_dir=${1:?Pass the directory containing reviewed HTTPS files}
site=/etc/nginx/sites-enabled/police-bootstrap.conf
previous=/etc/nginx/sites-available/police-bootstrap.conf
[[ -L "$site" && $(readlink -f "$site") == "$previous" ]] || {
    printf '%s\n' 'Expected owned bootstrap symlink missing; review before switching.' >&2; exit 1;
}
test -s /etc/letsencrypt/live/sunnytech.cloud/fullchain.pem
test -s /etc/letsencrypt/live/sunnytech.cloud/privkey.pem
bash -n "$source_dir/reload-nginx-after-renewal.sh"
install -m 0644 "$source_dir/nginx-https-maintenance.conf" /etc/nginx/sites-available/police-https-maintenance.conf
ln -sfn /etc/nginx/sites-available/police-https-maintenance.conf "$site"
if ! nginx -t; then
    ln -sfn "$previous" "$site"
    printf '%s\n' 'HTTPS validation failed; restored bootstrap symlink without reloading.' >&2
    exit 1
fi
install -d -m 0755 /etc/letsencrypt/renewal-hooks/deploy
install -m 0700 "$source_dir/reload-nginx-after-renewal.sh" /etc/letsencrypt/renewal-hooks/deploy/police-reload-nginx
systemctl reload nginx.service
ufw allow 443/tcp comment 'HTTPS maintenance; app not deployed'
printf '%s\n' 'HTTPS maintenance enabled. Application/MFA/data cutover still require separate gates.'
