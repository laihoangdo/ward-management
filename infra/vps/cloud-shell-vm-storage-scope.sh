#!/usr/bin/env bash
# Cloud Shell project-owner action; a planned STAGING outage is required to change VM scopes.
set -euo pipefail
project=project-c5680fe1-4087-4ff9-829
instance=instance-household
zone=asia-southeast1-a
region=asia-southeast1
expected_ip=34.143.223.166
service_account=194646196669-compute@developer.gserviceaccount.com
actor=$(gcloud auth list --filter=status:ACTIVE --format='value(account)')
[[ -n "$actor" && "$actor" != *gserviceaccount.com ]] || { printf '%s\n' 'Use your authorized human Cloud Shell account.' >&2; exit 1; }
actual_ip=$(gcloud compute instances describe "$instance" --project="$project" --zone="$zone" --format='value(networkInterfaces[0].accessConfigs[0].natIP)')
actual_sa=$(gcloud compute instances describe "$instance" --project="$project" --zone="$zone" --format='value(serviceAccounts[0].email)')
[[ "$actual_ip" == "$expected_ip" && "$actual_sa" == "$service_account" ]] || { printf '%s\n' 'VM identity/IP mismatch; stop and review.' >&2; exit 1; }
printf '%s\n' 'This reserves the current origin IP if needed, stops STAGING, changes only OAuth scopes, then restarts it.'
printf '%s\n' 'A verified encrypted local recovery snapshot must already exist. No IAM Editor/Owner role is added.'
read -r -p 'Type STOP-STAGING to approve the outage: ' approval
[[ "$approval" == STOP-STAGING ]] || exit 1
reserved=$(gcloud compute addresses list --project="$project" --filter="address=$expected_ip" --format='value(address)')
if [[ -z "$reserved" ]]; then
    gcloud compute addresses create sunnytech-origin-ip --project="$project" --region="$region" --addresses="$expected_ip"
fi
gcloud compute instances stop "$instance" --project="$project" --zone="$zone" --quiet
scopes='https://www.googleapis.com/auth/devstorage.read_write,https://www.googleapis.com/auth/logging.write,https://www.googleapis.com/auth/monitoring.write,https://www.googleapis.com/auth/service.management.readonly,https://www.googleapis.com/auth/servicecontrol,https://www.googleapis.com/auth/trace.append'
if ! gcloud compute instances set-service-account "$instance" --project="$project" --zone="$zone" --service-account="$service_account" --scopes="$scopes" --quiet; then
    gcloud compute instances start "$instance" --project="$project" --zone="$zone" --quiet
    printf '%s\n' 'Scope change failed; VM restarted with previous configuration. Review Cloud Shell error.' >&2
    exit 1
fi
gcloud compute instances start "$instance" --project="$project" --zone="$zone" --quiet
printf '%s\n' 'VM restarted. Ask the deployment agent to verify fresh SSH/TLS/container health and perform the first GCS upload.'
