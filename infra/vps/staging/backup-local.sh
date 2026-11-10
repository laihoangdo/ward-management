#!/usr/bin/env bash
# Local encrypted recovery only. This cannot survive loss/root compromise of the same VPS.
set -euo pipefail
umask 077
[[ ${EUID} -eq 0 ]] || { printf '%s\n' 'Run via sudo.' >&2; exit 1; }
exec 9>/run/lock/police-staging-backup.lock
flock -n 9 || { printf '%s\n' 'A staging backup is already running.' >&2; exit 1; }
key=/etc/police-management/secrets/local_backup_passphrase
test -s "$key"
destination=/var/backups/police-management
install -d -m 0700 "$destination"
available=$(df --output=avail -k "$destination" | tail -n 1 | tr -d ' ')
[[ "$available" -ge 1048576 ]] || { printf '%s\n' 'Less than 1 GiB free: backup blocked.' >&2; exit 1; }
work=$(mktemp -d "$destination/.staging-work.XXXXXXXX")
output="$destination/staging-$(date -u +%Y%m%dT%H%M%SZ).tar.gz.gpg"
cleanup() {
    rm -f -- "$work/database.dump" "$work/keycloak.dump" "$work/roles.sql" "$work/metadata.json"
    rmdir "$work"
}
trap cleanup EXIT
compose=(docker compose -f /opt/police-management/staging/compose.yml)
for entry in 'Monolithic:database.dump' 'keycloak:keycloak.dump'; do
    database=${entry%%:*}
    file=${entry#*:}
    "${compose[@]}" exec -T database bash -ec 'export PGPASSWORD="$(cat /run/secrets/database_owner)"; exec pg_dump -U Monolithic -Fc -d "$1"' -- "$database" > "$work/$file"
done
"${compose[@]}" exec -T database bash -ec 'export PGPASSWORD="$(cat /run/secrets/database_owner)"; exec pg_dumpall -U Monolithic --roles-only' > "$work/roles.sql"
printf '{"scope":"synthetic-staging","format":1,"crossDatabaseAtomic":false,"offsite":false}\n' > "$work/metadata.json"
# Includes app key, Keycloak/config credentials and image manifests, but NOT the backup passphrase.
tar -czf - -C "$work" . -C /etc/police-management secrets/staging -C /opt/police-management staging -C /etc nginx letsencrypt \
    | gpg --batch --pinentry-mode loopback --passphrase-file "$key" --symmetric --cipher-algo AES256 --output "$output.partial"
mv -- "$output.partial" "$output"
sha256sum "$output" > "$output.sha256"
printf '%s\n' "$output"
