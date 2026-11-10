#!/usr/bin/env bash
# Explicit operator action only; does not deploy the application or migrate data.
set -euo pipefail
[[ ${EUID} -eq 0 ]] || { printf '%s\n' 'Run via sudo.' >&2; exit 1; }
domain=sunnytech.cloud
expected_ip=34.143.223.166
email=laihoangdo0506@gmail.com

# Fail closed rather than sending repeated ACME requests while DNS is missing/wrong.
mapfile -t addresses < <(getent ahostsv4 "$domain" | awk '{print $1}' | sort -u)
[[ ${#addresses[@]} -gt 0 ]] || { printf '%s\n' 'DNS A record missing; no ACME request made.' >&2; exit 1; }
for ip in "${addresses[@]}"; do
    [[ "$ip" == "$expected_ip" ]] || { printf '%s\n' 'DNS does not point exclusively to the approved VPS; no ACME request made.' >&2; exit 1; }
done
if getent ahosts "$domain" | awk '{print $1}' | grep -q ':'; then
    printf '%s\n' 'IPv6 needs separate reachability validation before HTTP-01; no ACME request made.' >&2
    exit 1
fi
nginx -t
certbot certonly --webroot --webroot-path /var/lib/police-acme \
    --domain "$domain" --email "$email" --agree-tos --non-interactive \
    --keep-until-expiring
printf '%s\n' 'Certificate obtained. HTTPS reverse-proxy configuration and external tests are still required.'
