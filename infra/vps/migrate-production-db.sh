#!/usr/bin/env bash
# Apply pending Liquibase changesets to the production database with the JAR of a reviewed image.
# Order: fresh encrypted offsite backup -> authenticated restore drill into a disposable database ->
# Liquibase status -> update -> status. Never resets, drops, rolls back or seeds data.
# Usage: sudo migrate-production-db.sh police-app-production:YYYYMMDD-N
set -euo pipefail
umask 077
[[ ${EUID} -eq 0 ]] || { printf '%s\n' 'Run via sudo.' >&2; exit 1; }

image=${1:?Pass the reviewed production image tag}
[[ "$image" =~ ^police-app-production:[0-9]{8}-[0-9]+$ ]] || { printf '%s\n' 'Unexpected image tag.' >&2; exit 1; }
docker image inspect "$image" >/dev/null

database=police-production-candidate-db-20261105
network=police-production_database
owner_secret=/etc/police-management/secrets/production-candidate-20261105/database_owner
backup_dir=/var/backups/police-management
passphrase=/etc/police-management/secrets/local_backup_passphrase
checkpoint=/root/police-deployment-checkpoints
test -s "$owner_secret"
test -s "$passphrase"

exec 9>/run/lock/police-production-migrate.lock
flock -n 9 || { printf '%s\n' 'A production migration is already running.' >&2; exit 1; }
install -d -m 0700 "$checkpoint"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
log() { printf '%s\n' "$checkpoint/production-$1-$stamp.log"; }

secrets_dir=$(mktemp -d /run/police-migrate.XXXXXXXX)
drill_dir=$(mktemp -d "$backup_dir/.production-drill.XXXXXXXX")
drill_db="tc2_premigrate_$(tr -dc 'a-z0-9' < /dev/urandom | head -c 12)"
admin_psql() {
    docker exec -i "$database" bash -ec \
        'export PGPASSWORD="$(cat /run/secrets/database_owner)"; exec psql -X -q -At -h 127.0.0.1 -U Monolithic -v ON_ERROR_STOP=1 -d "$1"' -- "$1"
}
cleanup() {
    rm -f -- "$secrets_dir/migration.properties" "$drill_dir/database.dump"
    rmdir "$secrets_dir" "$drill_dir" 2>/dev/null || true
    printf 'DROP DATABASE IF EXISTS "%s";\n' "$drill_db" | admin_psql postgres >/dev/null 2>&1 || true
}
trap cleanup EXIT

# 1. Fresh encrypted backup, delivered offsite, before any schema change.
if ! /opt/police-management/production/backup-production-offsite.sh >"$(log pre-migration-backup)" 2>&1; then
    printf '%s\n' 'Offsite backup failed; migration blocked. Inspect root-only backup log.' >&2
    exit 1
fi
archive=$(ls -1t "$backup_dir"/production-*.tar.gz.gpg | head -n 1)
(cd "$(dirname "$archive")" && sha256sum -c --quiet "$(basename "$archive").sha256")

# 2. Authenticated restore drill: the new archive must decrypt and restore with the live row counts.
gpg --batch --quiet --pinentry-mode loopback --passphrase-file "$passphrase" --decrypt "$archive" \
    | tar -xzf - -C "$drill_dir" ./database.dump
printf 'CREATE DATABASE "%s" TEMPLATE template0;\n' "$drill_db" | admin_psql postgres >/dev/null
if ! docker exec -i "$database" bash -ec \
    'export PGPASSWORD="$(cat /run/secrets/database_owner)"; exec pg_restore -h 127.0.0.1 -U Monolithic --no-owner --no-privileges --exit-on-error -d "$1"' -- "$drill_db" \
    < "$drill_dir/database.dump" >"$(log pre-migration-drill)" 2>&1; then
    printf '%s\n' 'Restore drill failed; migration blocked. Inspect root-only drill log.' >&2
    exit 1
fi
counts='SELECT (SELECT count(*) FROM public.household) || '"'"'/'"'"' || (SELECT count(*) FROM public.resident) || '"'"'/'"'"' || (SELECT count(*) FROM public.databasechangelog);'
[[ "$(admin_psql "$drill_db" <<<"$counts")" == "$(admin_psql Monolithic <<<"$counts")" ]] \
    || { printf '%s\n' 'Restored drill counts differ from the live database; migration blocked.' >&2; exit 1; }
rm -f -- "$drill_dir/database.dump"
printf 'DROP DATABASE "%s";\n' "$drill_db" | admin_psql postgres >/dev/null

# 3. Liquibase through the reviewed image. Credentials live only on tmpfs for this run.
chmod 0711 "$secrets_dir"
{
    printf '%s\n' "url=jdbc:postgresql://$database:5432/Monolithic" 'username=Monolithic'
    printf 'password=%s\n' "$(cat "$owner_secret")"
    printf '%s\n' 'changeLogFile=config/liquibase/master.xml' 'contexts=!test and !faker' 'defaultSchemaName=public'
} > "$secrets_dir/migration.properties"
chmod 0444 "$secrets_dir/migration.properties"
liquibase() {
    docker run --rm --network "$network" --read-only --tmpfs /tmp:rw,nosuid,size=128m,uid=1000,gid=1000,mode=1777 \
        --cap-drop ALL --security-opt no-new-privileges:true --memory 1024m \
        --mount "type=bind,source=$secrets_dir/migration.properties,target=/run/secrets/migration.properties,readonly" \
        --entrypoint java "$image" \
        -Dloader.main=liquibase.integration.commandline.Main -cp /app/release.jar \
        org.springframework.boot.loader.launch.PropertiesLauncher \
        --defaultsFile=/run/secrets/migration.properties "$1"
}
liquibase status >"$(log liquibase-status-before)" 2>&1 \
    || { printf '%s\n' 'Liquibase status failed; migration blocked.' >&2; exit 1; }
liquibase update >"$(log liquibase-update)" 2>&1 \
    || { printf '%s\n' 'Liquibase update failed; keep the current image and inspect the root-only log before any retry.' >&2; exit 1; }
liquibase status >"$(log liquibase-status-after)" 2>&1 && grep -Fq 'is up to date' "$(log liquibase-status-after)" \
    || { printf '%s\n' 'Post-migration status is not up to date; application rollout blocked.' >&2; exit 1; }
printf '%s\n' "PRODUCTION_MIGRATION_PASS backup=$(basename "$archive")"
