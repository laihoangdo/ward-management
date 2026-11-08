#!/usr/bin/env bash
# Local encrypted production recovery only. This cannot survive loss/root compromise of the same VPS.
set -euo pipefail
umask 077
[[ ${EUID} -eq 0 ]] || { printf '%s\n' 'Run via sudo.' >&2; exit 1; }
exec 9>/run/lock/police-production-backup.lock
flock -n 9 || { printf '%s\n' 'A production backup is already running.' >&2; exit 1; }
key=/etc/police-management/secrets/local_backup_passphrase
test -s "$key"
destination=/var/backups/police-management
install -d -m 0700 "$destination"
available=$(df --output=avail -k "$destination" | tail -n 1 | tr -d ' ')
[[ "$available" -ge 1048576 ]] || { printf '%s\n' 'Less than 1 GiB free: backup blocked.' >&2; exit 1; }
work=$(mktemp -d "$destination/.production-work.XXXXXXXX")
output="$destination/production-$(date -u +%Y%m%dT%H%M%SZ).tar.gz.gpg"
cleanup() {
    rm -f -- "$work/database.dump" "$work/keycloak.dump" "$work/roles.sql" "$work/metadata.json"
    rmdir "$work"
}
trap cleanup EXIT
dump() {
    docker exec -i "$1" bash -ec 'export PGPASSWORD="$(cat /run/secrets/database_owner)"; exec pg_dump -h 127.0.0.1 -U Monolithic -Fc -d "$1"' -- "$2"
}
dump police-production-candidate-db-20261105 Monolithic > "$work/database.dump"
dump police-staging-database-1 keycloak > "$work/keycloak.dump"
docker exec -i police-production-candidate-db-20261105 bash -ec \
    'export PGPASSWORD="$(cat /run/secrets/database_owner)"; exec pg_dumpall -h 127.0.0.1 -U Monolithic --roles-only' > "$work/roles.sql"
printf '{"scope":"production","format":1,"crossDatabaseAtomic":false,"offsite":false}\n' > "$work/metadata.json"
# Includes production app/identity secrets and the candidate key, but NOT the backup passphrase.
tar -czf - -C "$work" . \
    -C /etc/police-management secrets/production secrets/production-candidate-20261105 \
    -C /opt/police-management production -C /etc nginx letsencrypt \
    | gpg --batch --pinentry-mode loopback --passphrase-file "$key" --symmetric --cipher-algo AES256 --output "$output.partial"
mv -- "$output.partial" "$output"
sha256sum "$output" > "$output.sha256"
printf '%s\n' "$output"
