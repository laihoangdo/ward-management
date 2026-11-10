#!/usr/bin/env bash
# Audited synthetic-staging update; migrates existing schema after an encrypted backup/drill.
set -euo pipefail
umask 077
[[ ${EUID} -eq 0 ]] || exit 1
source_dir=$(readlink -f "${1:?Pass the reviewed upload directory}")
expected=${2:?Pass locally audited SHA256}
[[ "$expected" =~ ^[A-Fa-f0-9]{64}$ ]] || exit 1
actual=$(sha256sum "$source_dir/release.jar" | cut -d ' ' -f 1)
[[ "$actual" == "${expected,,}" ]] || { printf '%s\n' 'Artifact checksum mismatch' >&2; exit 1; }
image=police-app-staging:20261105-3
if docker image inspect "$image" >/dev/null 2>&1; then
    printf '%s\n' 'Release tag exists; do not overwrite immutable staging release.' >&2; exit 1
fi
candidate="$image-candidate-$(date -u +%Y%m%dT%H%M%SZ)-$$"
docker buildx version >/dev/null
destination=/opt/police-management/staging
# Keep the previous JAR/hash/config as a distinct owned rollback checkpoint.
stamp=$(date -u +%Y%m%dT%H%M%SZ)
checkpoint="/root/police-deployment-checkpoints/app-before-20261105-3-$stamp"
install -d -m 0700 "$checkpoint"
cp "$destination/release.jar" "$destination/release.sha256" "$destination/app.compose.yml" "$checkpoint/"
install -m 0444 "$source_dir/release.jar" "$destination/release.jar"
cd "$destination"
docker build -f App.Dockerfile -t "$candidate" .
scanner=/opt/police-management/security/trivy
[[ -x "$scanner" ]] || { printf '%s\n' 'Trivy is required; staging rollout blocked.' >&2; exit 1; }
scan_dir=/var/lib/police-management/scans
install -d -m 0700 "$scan_dir"
scan_report="$scan_dir/${image##*:}.json"
"$scanner" image --quiet --scanners vuln --severity HIGH,CRITICAL --exit-code 1 \
    --format json --output "$scan_report" "$candidate"
docker image tag "$candidate" "$image"
docker image rm "$candidate" >/dev/null
install -m 0644 "$source_dir/app.compose.yml" "$destination/app.compose.yml"
printf '%s  release.jar\n' "$actual" > "$destination/release.sha256"
docker compose -f compose.yml -f app.compose.yml config --quiet
if ! "$destination/migrate-existing-staging-db.sh"; then
    cp "$checkpoint/app.compose.yml" "$destination/app.compose.yml"
    cp "$checkpoint/release.jar" "$destination/release.jar"
    cp "$checkpoint/release.sha256" "$destination/release.sha256"
    printf '%s\n' 'Staging database migration failed; previous application/config remain active. Inspect root-only migration logs.' >&2
    exit 1
fi
if ! docker compose -f compose.yml -f app.compose.yml up -d --no-deps --wait --wait-timeout 240 app; then
    cp "$checkpoint/app.compose.yml" "$destination/app.compose.yml"
    cp "$checkpoint/release.jar" "$destination/release.jar"
    cp "$checkpoint/release.sha256" "$destination/release.sha256"
    docker compose -f compose.yml -f app.compose.yml up -d --no-deps app
    printf '%s\n' 'Health gate failed; reverted to previous staged image/config.' >&2
    exit 1
fi
python3 "$destination/verify-app.py"
