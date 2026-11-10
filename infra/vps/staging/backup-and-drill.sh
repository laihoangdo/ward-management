#!/usr/bin/env bash
set -euo pipefail
[[ ${EUID} -eq 0 ]] || exit 1
backup=$(/opt/police-management/staging/backup-local.sh)
printf '%s\n' "$backup"
python3 /opt/police-management/staging/restore-drill.py "$backup"
