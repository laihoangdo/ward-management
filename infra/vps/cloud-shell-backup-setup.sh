#!/usr/bin/env bash
# Run by the project owner in GOOGLE CLOUD SHELL, never by elevating the restricted VPS identity.
# Creates billable private storage; review before confirming. No service-account JSON key is created.
set -euo pipefail
project=project-c5680fe1-4087-4ff9-829
bucket=gs://sunnytech-backups-194646196669
uploader=194646196669-compute@developer.gserviceaccount.com
actor=$(gcloud auth list --filter=status:ACTIVE --format='value(account)')
[[ -n "$actor" && "$actor" != *gserviceaccount.com ]] || { printf '%s\n' 'Use your authorized human Cloud Shell account.' >&2; exit 1; }
printf '%s\n' 'Creates a private Singapore bucket with a 30-day minimum retention, NOT an irreversible retention lock.'
printf '%s\n' 'Storage/egress charges apply; no lifecycle deletion policy is silently installed.'
printf '%s\n' 'Also enables required APIs and grants the VM write-only Logging/Monitoring roles for the existing Ops Agent.'
read -r -p 'Type CREATE-SUNNYTECH-BACKUP to approve: ' approval
[[ "$approval" == CREATE-SUNNYTECH-BACKUP ]] || exit 1
if gcloud storage buckets describe "$bucket" --project="$project" >/dev/null 2>&1; then
    printf '%s\n' 'Bucket exists; review its location/IAM/retention rather than overwriting it.' >&2
    exit 1
fi
gcloud services enable storage.googleapis.com logging.googleapis.com monitoring.googleapis.com --project="$project"
gcloud storage buckets create "$bucket" --project="$project" --location=asia-southeast1 \
    --uniform-bucket-level-access --public-access-prevention --retention-period=P30D
gcloud storage buckets add-iam-policy-binding "$bucket" --project="$project" \
    --member="serviceAccount:$uploader" --role=roles/storage.objectCreator
for role in roles/logging.logWriter roles/monitoring.metricWriter; do
    gcloud projects add-iam-policy-binding "$project" --member="serviceAccount:$uploader" --role="$role" --condition=None --quiet
done
printf '%s\n' 'Bucket ready: CREATE objects only. Ops Agent has write-only log/metric roles; no object read/delete, Storage Admin or Editor/Owner grant was made.'
printf '%s\n' 'VPS still needs its read-only OAuth storage scope changed by the separate reviewed scope-update procedure.'
