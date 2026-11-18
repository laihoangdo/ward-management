#!/usr/bin/env bash
# Initial install only: serve HTTP-01 + maintenance, never application data.
set -euo pipefail
[[ ${EUID} -eq 0 ]] || { printf '%s\n' 'Run via sudo.' >&2; exit 1; }
source_dir=${1:?Pass the directory containing the reviewed bootstrap files}
site=/etc/nginx/sites-enabled/police-bootstrap.conf
[[ ! -e "$site" && ! -L "$site" ]] || { printf '%s\n' 'Bootstrap site already exists; review explicitly.' >&2; exit 1; }
if [[ -e /etc/nginx/sites-enabled/default || -L /etc/nginx/sites-enabled/default ]]; then
    [[ -L /etc/nginx/sites-enabled/default && $(readlink -f /etc/nginx/sites-enabled/default) == /etc/nginx/sites-available/default ]] || {
        printf '%s\n' 'Unexpected default site; refusing to overwrite.' >&2; exit 1;
    }
fi
bash -n "$source_dir/issue-certificate.sh"
install -d -m 0700 /root/police-deployment-checkpoints
tar --create --file="/root/police-deployment-checkpoints/nginx-before-$(date -u +%Y%m%dT%H%M%SZ).tar" --directory=/etc nginx
install -d -m 0755 /var/lib/police-acme/.well-known/acme-challenge
install -m 0644 "$source_dir/nginx-bootstrap.conf" /etc/nginx/sites-available/police-bootstrap.conf
install -m 0700 "$source_dir/issue-certificate.sh" /opt/police-management/issue-certificate.sh
if [[ -L /etc/nginx/sites-enabled/default ]]; then unlink /etc/nginx/sites-enabled/default; fi
ln -s /etc/nginx/sites-available/police-bootstrap.conf "$site"
nginx -t
systemctl unmask nginx.service
systemctl enable --now nginx.service
ufw allow 80/tcp comment 'ACME and maintenance only'
printf '%s\n' 'HTTP bootstrap active. HTTPS, MFA and application remain undeployed.'
