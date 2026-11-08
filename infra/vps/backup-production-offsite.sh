#!/usr/bin/env bash
# Daily encrypted production backup with offsite delivery; never uploads plaintext.
set -euo pipefail
umask 077
[[ ${EUID} -eq 0 ]] || exit 1
exec 8>/run/lock/police-production-offsite.lock
flock -n 8 || exit 1
backup=$(/opt/police-management/production/backup-production-local.sh)
python3 /opt/police-management/production/upload-production-backup.py "$backup"
