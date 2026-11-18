#!/usr/bin/env bash
# Switch the public route from maintenance to the production application.
# Auto-rolls-back to maintenance on any failed check. Never deletes configs.
set -euo pipefail
[[ ${EUID} -eq 0 ]] || { printf '%s\n' 'Run via sudo.' >&2; exit 1; }

marker=/var/lib/police-management/production-app-20261107.json
python3 - "$marker" <<'PY'
import json, sys
state = json.load(open(sys.argv[1]))
sys.exit(0 if state.get('result') == 'PRODUCTION_APP_DEPLOYED' else 1)
PY

backup=/root/police-nginx-cutover-$(date -u +%Y%m%dT%H%M%SZ)
install -d -m 0700 "$backup"
cp -a /etc/nginx/sites-available/police-identity-staging.conf "$backup/"
cp -a /etc/nginx/sites-available/zz-police-staging-internal.conf "$backup/"

cat > /etc/nginx/sites-available/police-production.conf <<'CONF'
# Production public site: real application plus both Keycloak realm routes.
log_format police_staging '$remote_addr [$time_iso8601] $request_method $uri $status $body_bytes_sent';
limit_req_zone $binary_remote_addr zone=police_staging_auth:10m rate=5r/s;
map $http_upgrade $connection_upgrade { default upgrade; '' ''; }

upstream police_staging_identity {
    server 127.0.0.1:18080;
    keepalive 16;
}

upstream police_production_app {
    server 127.0.0.1:18082;
    keepalive 16;
}

server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    server_tokens off;
    access_log /var/log/nginx/police-staging-access.log police_staging;
    return 404;
}

server {
    listen 80;
    listen [::]:80;
    server_name sunnytech.cloud;
    server_tokens off;
    access_log /var/log/nginx/police-staging-access.log police_staging;
    location ^~ /.well-known/acme-challenge/ {
        root /var/lib/police-acme;
        default_type text/plain;
        limit_except GET { deny all; }
        try_files $uri =404;
    }
    location / { return 308 https://sunnytech.cloud$request_uri; }
}

server {
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;
    server_name _;
    ssl_reject_handshake on;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name sunnytech.cloud;
    server_tokens off;
    ssl_certificate /etc/letsencrypt/live/sunnytech.cloud/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sunnytech.cloud/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache shared:police_tls:10m;
    ssl_session_timeout 10m;
    ssl_session_tickets off;
    client_max_body_size 1m;
    access_log /var/log/nginx/police-staging-access.log police_staging;
    error_log /var/log/nginx/police-staging-error.log crit;

    add_header Strict-Transport-Security "max-age=86400" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer" always;
    add_header Cache-Control "no-store" always;
    add_header Content-Security-Policy "default-src 'none'; frame-ancestors 'none'; base-uri 'none'" always;

    location ^~ /admin/ { return 404; }
    location = /admin { return 404; }
    location ^~ /management/ { return 404; }

    location ^~ /realms/police-staging/ {
        limit_req zone=police_staging_auth burst=30 nodelay;
        limit_req_status 429;
        include /etc/nginx/snippets/police-staging-identity-proxy.conf;
    }
    location ^~ /realms/jhipster/ {
        limit_req zone=police_staging_auth burst=30 nodelay;
        limit_req_status 429;
        include /etc/nginx/snippets/police-staging-identity-proxy.conf;
    }
    location ^~ /resources/ {
        include /etc/nginx/snippets/police-staging-identity-proxy.conf;
    }
    location / {
        proxy_pass http://police_production_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-Port 443;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_connect_timeout 5s;
        proxy_read_timeout 75s;
        proxy_buffering off;
        client_max_body_size 25m;
        # Declaring headers here stops inheritance of the maintenance CSP above;
        # the application emits its own full CSP.
        add_header Strict-Transport-Security "max-age=86400" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "no-referrer" always;
        add_header Content-Security-Policy "frame-ancestors 'none'" always;
    }
}
CONF

cat > /etc/nginx/sites-available/zz-police-production-internal.conf <<'CONF'
# Dedicated Docker-host gateway, never 0.0.0.0/public IP. Backend admin calls retain TLS.
server {
    listen 172.29.40.1:18443 ssl;
    listen 172.29.41.1:18443 ssl;
    server_name sunnytech.cloud;
    server_tokens off;
    ssl_certificate /etc/letsencrypt/live/sunnytech.cloud/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sunnytech.cloud/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_tickets off;
    allow 172.29.40.10/32;
    allow 172.29.41.0/24;
    allow 127.0.0.1;
    deny all;
    access_log /var/log/nginx/police-staging-internal-access.log police_staging;
    error_log /var/log/nginx/police-staging-internal-error.log crit;
    client_max_body_size 1m;

    location = /realms/police-staging/protocol/openid-connect/token {
        include /etc/nginx/snippets/police-staging-identity-proxy.conf;
    }
    location ^~ /admin/realms/police-staging/ {
        include /etc/nginx/snippets/police-staging-identity-proxy.conf;
    }
    location = /realms/jhipster/protocol/openid-connect/token {
        include /etc/nginx/snippets/police-staging-identity-proxy.conf;
    }
    location ^~ /admin/realms/jhipster/ {
        include /etc/nginx/snippets/police-staging-identity-proxy.conf;
    }
    location / { return 404; }
}
CONF

rollback() {
    ln -sfn /etc/nginx/sites-available/police-identity-staging.conf /etc/nginx/sites-enabled/police-bootstrap.conf
    ln -sfn /etc/nginx/sites-available/zz-police-staging-internal.conf /etc/nginx/sites-enabled/zz-police-staging-internal.conf
    nginx -t && systemctl reload nginx || true
    printf '%s\n' 'Rolled back to maintenance configuration.' >&2
}
trap rollback ERR

ln -sfn /etc/nginx/sites-available/police-production.conf /etc/nginx/sites-enabled/police-bootstrap.conf
ln -sfn /etc/nginx/sites-available/zz-police-production-internal.conf /etc/nginx/sites-enabled/zz-police-staging-internal.conf
nginx -t
systemctl reload nginx
sleep 3

code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 https://sunnytech.cloud/)
[[ "$code" == 200 ]] || { printf 'public root returned %s\n' "$code" >&2; exit 1; }
realm=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 https://sunnytech.cloud/realms/jhipster/.well-known/openid-configuration)
[[ "$realm" == 200 ]] || { printf 'production realm discovery returned %s\n' "$realm" >&2; exit 1; }
anon=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 https://sunnytech.cloud/api/rbac/me)
[[ "$anon" == 401 ]] || { printf 'anonymous rbac returned %s\n' "$anon" >&2; exit 1; }
manifest=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 https://sunnytech.cloud/staging-manifest.json)
[[ "$manifest" == 404 ]] || { printf 'staging manifest returned %s\n' "$manifest" >&2; exit 1; }

marker_file=/var/lib/police-management/production-cutover-20261107.json
printf '{"result":"CUTOVER_ACTIVE","at":"%s","rollbackBackup":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$backup" > "$marker_file"
chmod 0600 "$marker_file"
trap - ERR
printf '%s\n' 'PASS: production cutover active; rollback configs saved under '"$backup"'.'
