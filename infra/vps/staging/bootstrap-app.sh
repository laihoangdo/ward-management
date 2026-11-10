#!/usr/bin/env bash
set -euo pipefail
umask 077
[[ ${EUID} -eq 0 ]] || { printf '%s\n' 'Run via sudo.' >&2; exit 1; }
docker buildx version >/dev/null || { printf '%s\n' 'Buildx is required for the per-Dockerfile secret-excluding build context.' >&2; exit 1; }
source_dir=${1:?Pass reviewed artifact/config directory}
expected=${2:?Pass locally audited JAR SHA256}
[[ "$expected" =~ ^[A-Fa-f0-9]{64}$ ]] || exit 1
actual=$(sha256sum "$source_dir/release.jar" | cut -d ' ' -f 1)
[[ "$actual" == "${expected,,}" ]] || { printf '%s\n' 'Artifact checksum differs; deployment blocked.' >&2; exit 1; }
if docker image inspect police-app-staging:20261104-2 >/dev/null 2>&1; then
    printf '%s\n' 'Release image tag already exists; do not overwrite an existing release.' >&2
    exit 1
fi
destination=/opt/police-management/staging
install -m 0444 "$source_dir/release.jar" "$destination/release.jar"
install -m 0644 "$source_dir/App.Dockerfile" "$source_dir/App.Dockerfile.dockerignore" "$source_dir/app.compose.yml" "$destination/"
printf '%s  release.jar\n' "$actual" > "$destination/release.sha256"
cd "$destination"
docker build -f App.Dockerfile -t police-app-staging:20261104-2 .
compose=(docker compose -f compose.yml -f app.compose.yml)
"${compose[@]}" config --quiet
if ! "${compose[@]}" run --rm migrate > /root/police-deployment-checkpoints/staging-app-migration-20261104.log 2>&1; then
    printf '%s\n' 'Staging migration failed. Inspect the root-only migration log privately; application not started.' >&2
    exit 1
fi
python3 "$destination/provision-runtime.py"
install -m 0644 "$source_dir/nginx-internal-identity.conf" /etc/nginx/sites-available/zz-police-staging-internal.conf
ln -s /etc/nginx/sites-available/zz-police-staging-internal.conf /etc/nginx/sites-enabled/zz-police-staging-internal.conf
nginx -t
systemctl reload nginx.service
ufw allow from 172.29.40.10 to 172.29.40.1 port 18443 proto tcp comment 'staging backend TLS identity admin only'
"${compose[@]}" up -d --no-deps --wait --wait-timeout 240 app
printf '%s\n' 'Synthetic application ready on loopback 18081 only. Public root remains maintenance.'
