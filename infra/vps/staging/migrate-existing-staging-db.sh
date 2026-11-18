#!/usr/bin/env bash
# Migrate only the existing synthetic staging schema after a fresh encrypted
# backup and authenticated restore drill. No reset, seed, drop or rollback.
set -euo pipefail
umask 077
[[ ${EUID} -eq 0 ]] || { printf '%s\n' 'Run via sudo.' >&2; exit 1; }

destination=/opt/police-management/staging
checkpoint=/root/police-deployment-checkpoints
lock=/run/lock/police-staging-migrate.lock
exec 9>"$lock"
flock -n 9 || { printf '%s\n' 'A staging migration is already running.' >&2; exit 1; }
[[ -x "$destination/backup-and-drill.sh" ]] || { printf '%s\n' 'Verified backup/drill script is missing.' >&2; exit 1; }
install -d -m 0700 "$checkpoint"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_log="$checkpoint/staging-pre-migration-backup-$stamp.log"
status_log="$checkpoint/staging-pre-migration-status-$stamp.log"
update_log="$checkpoint/staging-liquibase-update-$stamp.log"
verify_log="$checkpoint/staging-post-migration-status-$stamp.log"
cd "$destination"
compose=(docker compose -f compose.yml -f app.compose.yml)

if ! "$destination/backup-and-drill.sh" >"$backup_log" 2>&1; then
    printf '%s\n' 'Encrypted backup/restore drill failed; migration blocked. Inspect root-only backup log.' >&2
    exit 1
fi
if ! grep -Fq 'PASS: encrypted backup authenticated' "$backup_log"; then
    printf '%s\n' 'Backup log lacks restore-drill PASS; migration blocked.' >&2
    exit 1
fi
if ! "${compose[@]}" run --rm migrate --defaultsFile=/run/secrets/migration.properties status >"$status_log" 2>&1; then
    printf '%s\n' 'Liquibase status failed; migration blocked. Inspect root-only status log.' >&2
    exit 1
fi
if ! "${compose[@]}" run --rm migrate --defaultsFile=/run/secrets/migration.properties update >"$update_log" 2>&1; then
    printf '%s\n' 'Liquibase update failed; application rollout blocked. Inspect root-only update log.' >&2
    exit 1
fi
if ! "${compose[@]}" run --rm migrate --defaultsFile=/run/secrets/migration.properties status >"$verify_log" 2>&1 || ! grep -Fq 'is up to date' "$verify_log"; then
    printf '%s\n' 'Post-migration Liquibase verification failed; application rollout blocked. Inspect root-only status log.' >&2
    exit 1
fi
printf '%s\n' 'PASS: encrypted backup restored and verified; Liquibase update completed; existing staging database is up to date.'
