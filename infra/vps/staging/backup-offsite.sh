#!/usr/bin/env bash
# Daily encrypted staging backup with offsite delivery; never uploads plaintext.
set -euo pipefail
umask 077
[[ ${EUID} -eq 0 ]] || exit 1
exec 8>/run/lock/police-staging-offsite.lock
flock -n 8 || exit 1
backup=$(/opt/police-management/staging/backup-local.sh)
/opt/police-management/staging/upload-offsite-backup.sh "$backup"
