#!/usr/bin/env bash
# Recover a short-lived Keycloak admin, retire the exposed bootstrap account, then remove recovery access.
set -euo pipefail
umask 077
[[ ${EUID} -eq 0 ]] || { printf '%s\n' 'Run via sudo.' >&2; exit 1; }
exec 9>/run/lock/police-bootstrap-retirement.lock
flock -n 9 || { printf '%s\n' 'Bootstrap retirement is already running; refusing.' >&2; exit 1; }

compose=/opt/police-management/staging/compose.yml
container=police-staging-keycloak-1
secrets=/etc/police-management/secrets/staging
bootstrap_secret=$secrets/keycloak_bootstrap
site=/etc/nginx/sites-enabled/police-bootstrap.conf
maintenance=/etc/nginx/sites-available/police-identity-staging.conf
config=/tmp/police-retire-bootstrap-$$.config
recovery_user=retire-recovery-$(date -u +%Y%m%d%H%M%S)-$(openssl rand -hex 3)
recovery_password=$(openssl rand -hex 32)
new_password=$(openssl rand -hex 32)
keycloak_stopped=0
recovery_created=0
recovery_removed=0
temporary_secret=
current_step=initial-prechecks

wait_keycloak_initialized() {
    for attempt in $(seq 1 90); do
        startup_logs=$(docker logs --tail 200 "$container" 2>&1 || true)
        if [[ "$startup_logs" == *'Bootstrap completed in'* ]]; then return 0; fi
        sleep 2
    done
    return 1
}

cleanup() {
    result=$?
    trap - EXIT HUP INT TERM
    if (( result != 0 )); then printf 'Bootstrap retirement stopped at stage: %s.\n' "$current_step" >&2; fi
    if (( keycloak_stopped )); then
        if docker compose -f "$compose" up -d --wait --wait-timeout 300 keycloak >/dev/null 2>&1 && wait_keycloak_initialized; then
            keycloak_stopped=0
        else
            printf '%s\n' 'Keycloak did not restart during cleanup; keep maintenance and investigate immediately.' >&2
            result=1
        fi
    fi
    if (( recovery_created && ! recovery_removed && ! keycloak_stopped )); then
        cleanup_config=/tmp/police-retire-cleanup-$$.config
        cleanup_id=
        if docker exec "$container" /opt/keycloak/bin/kcadm.sh config credentials \
            --server http://localhost:8080 --realm master --user "$recovery_user" \
            --password "$recovery_password" --config "$cleanup_config" >/dev/null 2>&1; then
            cleanup_user_json=$(docker exec "$container" /opt/keycloak/bin/kcadm.sh get users -r master \
                -q "username=$recovery_user" --fields id --config "$cleanup_config" 2>/dev/null || true)
            cleanup_id=$(printf '%s' "$cleanup_user_json" | python3 -c 'import json,sys; a=json.load(sys.stdin); print(a[0]["id"] if len(a)==1 else "")' 2>/dev/null || true)
            if [[ -n "$cleanup_id" ]] && docker exec "$container" /opt/keycloak/bin/kcadm.sh delete \
                "users/$cleanup_id" -r master --config "$cleanup_config" >/dev/null 2>&1; then
                recovery_removed=1
            fi
        fi
        docker exec "$container" rm -f "$cleanup_config" >/dev/null 2>&1 || true
        if (( ! recovery_removed )); then
            printf '%s\n' 'WARNING: temporary recovery admin may remain; immediately remove it through the loopback-only master console.' >&2
            result=1
        fi
    fi
    docker exec "$container" rm -f "$config" >/dev/null 2>&1 || true
    [[ -z "$temporary_secret" ]] || rm -f "$temporary_secret"
    unset recovery_password new_password KC_RECOVERY_PASSWORD bootstrap_password
    exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

[[ -f "$compose" && -f "$bootstrap_secret" && ! -L "$bootstrap_secret" ]] || {
    printf '%s\n' 'Expected staging Compose file and regular bootstrap secret are required; refusing.' >&2; exit 1;
}
[[ -L "$site" && $(readlink -f "$site") == "$maintenance" ]] || {
    printf '%s\n' 'Public identity site is not in the expected maintenance configuration; refusing.' >&2; exit 1;
}
nginx -t >/dev/null
root_status=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 https://sunnytech.cloud/)
[[ "$root_status" == 503 ]] || { printf '%s\n' 'Public root is not 503 maintenance; refusing.' >&2; exit 1; }
docker compose -f "$compose" config --quiet

running=$(docker compose -f "$compose" ps --status running --quiet keycloak)
[[ -n "$running" && $(docker inspect --format '{{.State.Health.Status}}' "$running") == healthy ]] || {
    printf '%s\n' 'Keycloak must be healthy before temporary-admin recovery.' >&2; exit 1;
}

# Keycloak requires all nodes stopped before its official bootstrap-admin recovery command.
current_step=offline-temporary-admin-recovery
docker compose -f "$compose" stop keycloak >/dev/null
keycloak_stopped=1
export KC_RECOVERY_PASSWORD="$recovery_password"
if ! docker compose -f "$compose" run --rm --no-deps -e KC_RECOVERY_PASSWORD keycloak \
    bootstrap-admin user --username "$recovery_user" --password:env KC_RECOVERY_PASSWORD --no-prompt >/dev/null 2>&1; then
    printf '%s\n' 'Keycloak temporary-admin recovery command failed; service will be restarted and public maintenance preserved.' >&2
    exit 1
fi
recovery_created=1
unset KC_RECOVERY_PASSWORD
printf '%s\n' 'PASS: temporary recovery admin provisioned while Keycloak was stopped.'

current_step=restart-keycloak-for-recovery
docker compose -f "$compose" up -d --wait --wait-timeout 300 keycloak >/dev/null
keycloak_stopped=0
current_step=wait-for-keycloak-import
wait_keycloak_initialized || { printf '%s\n' 'Keycloak health became ready before startup completed; waiting for bootstrap completion failed.' >&2; exit 1; }
run_kcadm() { docker exec "$container" /opt/keycloak/bin/kcadm.sh "$@" --config "$config"; }
recovery_login() {
    current_step=refresh-temporary-admin-session
    for attempt in 1 2 3 4; do
        if run_kcadm config credentials --server http://localhost:8080 --realm master \
            --user "$recovery_user" --password "$recovery_password" >/dev/null 2>&1; then
            return 0
        fi
        sleep 2
    done
    printf '%s\n' 'Temporary recovery admin login did not succeed after bounded retries.' >&2
    return 1
}
recovery_login

current_step=verify-named-master-admin
owner_json=$(run_kcadm get users -r master -q username=laihoangdo --fields id,enabled,requiredActions)
owner_id=$(printf '%s' "$owner_json" | python3 -c 'import json,sys; a=json.load(sys.stdin); print(a[0]["id"] if len(a)==1 and a[0].get("enabled") and not set(a[0].get("requiredActions",[])).intersection({"CONFIGURE_TOTP","CONFIGURE_OTP","UPDATE_PASSWORD"}) else "")')
[[ -n "$owner_id" ]] || { printf '%s\n' 'Named master administrator is missing, disabled, or has a pending password/OTP action; refusing retirement.' >&2; exit 1; }
owner_credentials=$(run_kcadm get "users/$owner_id/credentials" -r master)
otp_count=$(printf '%s' "$owner_credentials" | python3 -c 'import json,sys; a=json.load(sys.stdin); print(sum(1 for c in a if c.get("type")=="otp"))')
[[ "$otp_count" -gt 0 ]] || { printf '%s\n' 'Named master administrator has no configured OTP credential; refusing retirement.' >&2; exit 1; }
current_step=verify-named-master-admin-role
owner_roles=$(run_kcadm get "users/$owner_id/role-mappings/realm" -r master)
printf '%s' "$owner_roles" | python3 -c 'import json,sys; a=json.load(sys.stdin); raise SystemExit(0 if any(r.get("name")=="admin" for r in a) else 1)' || {
    printf '%s\n' 'Named master administrator lacks the expected admin role; refusing retirement.' >&2; exit 1;
}
printf '%s\n' 'PASS: named master admin is enabled, has the admin role and configured OTP.'

current_step=inspect-bootstrap-account
bootstrap_json=$(run_kcadm get users -r master -q username=staging-bootstrap --fields id,enabled)
bootstrap_info=$(printf '%s' "$bootstrap_json" | python3 -c 'import json,sys; a=json.load(sys.stdin); print((a[0].get("id","")+"\t"+str(a[0].get("enabled",False)).lower()) if len(a)==1 else "\t")')
IFS=$'\t' read -r bootstrap_id bootstrap_enabled <<< "$bootstrap_info"
if [[ -n "$bootstrap_id" && "$bootstrap_enabled" == true ]]; then
    current_step=rotate-bootstrap-account-password
    run_kcadm set-password -r master --userid "$bootstrap_id" --new-password "$new_password" >/dev/null 2>&1
    # Password changes can invalidate the current admin token; renew it before disabling the user.
    recovery_login
    current_step=disable-bootstrap-account
    run_kcadm update "users/$bootstrap_id" -r master -s enabled=false >/dev/null 2>&1
    recovery_login
    bootstrap_check=$(run_kcadm get "users/$bootstrap_id" -r master --fields enabled)
    printf '%s' "$bootstrap_check" | python3 -c 'import json,sys; u=json.load(sys.stdin); raise SystemExit(0 if u.get("enabled") is False else 1)' || {
        printf '%s\n' 'Bootstrap account did not verify disabled; refusing to restart with the old secret.' >&2; exit 1;
    }
    printf '%s\n' 'PASS: temporary bootstrap account password rotated and account disabled.'
elif [[ -n "$bootstrap_id" && "$bootstrap_enabled" != false ]]; then
    printf '%s\n' 'Unexpected bootstrap account state; refusing.' >&2; exit 1
else
    printf '%s\n' 'PASS: temporary bootstrap account is already absent or disabled.'
fi

current_step=rotate-bootstrap-secret-file
temporary_secret=$(mktemp "$secrets/.keycloak_bootstrap.XXXXXX")
printf '%s' "$new_password" > "$temporary_secret"
chown root:root "$temporary_secret"
chmod 0444 "$temporary_secret"
mv -f "$temporary_secret" "$bootstrap_secret"
temporary_secret=
docker compose -f "$compose" config --quiet
current_step=recreate-keycloak-with-rotated-secret
docker compose -f "$compose" up -d --force-recreate --wait --wait-timeout 300 keycloak >/dev/null
wait_keycloak_initialized || { printf '%s\n' 'Keycloak startup did not complete after secret rotation.' >&2; exit 1; }

current_step=verify-staging-and-maintenance
running=$(docker compose -f "$compose" ps --status running --quiet keycloak)
[[ -n "$running" && $(docker inspect --format '{{.State.Health.Status}}' "$running") == healthy ]] || {
    printf '%s\n' 'Keycloak did not return healthy after secret rotation; keep public maintenance and investigate.' >&2; exit 1;
}
python3 /opt/police-management/staging/verify-app.py >/dev/null
root_status=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 https://sunnytech.cloud/)
[[ "$root_status" == 503 ]] || { printf '%s\n' 'Public root left maintenance unexpectedly; investigate immediately.' >&2; exit 1; }

# Recreate the admin session after Keycloak replacement, then remove the temporary recovery account.
current_step=remove-temporary-recovery-admin
run_kcadm config credentials --server http://localhost:8080 --realm master \
    --user "$recovery_user" --password "$recovery_password" >/dev/null 2>&1
recovery_json=$(run_kcadm get users -r master -q "username=$recovery_user" --fields id)
recovery_id=$(printf '%s' "$recovery_json" | python3 -c 'import json,sys; a=json.load(sys.stdin); print(a[0]["id"] if len(a)==1 else "")')
[[ -n "$recovery_id" ]] || { printf '%s\n' 'Temporary recovery admin was not found for cleanup.' >&2; exit 1; }
run_kcadm delete "users/$recovery_id" -r master >/dev/null 2>&1
recovery_removed=1

bootstrap_probe=/tmp/police-bootstrap-retired-$$.config
current_step=verify-retired-credentials
if docker exec "$container" /opt/keycloak/bin/kcadm.sh config credentials --server http://localhost:8080 \
    --realm master --user staging-bootstrap --password "$new_password" --config "$bootstrap_probe" >/dev/null 2>&1; then
    printf '%s\n' 'Retired bootstrap credentials still authenticate; investigate immediately.' >&2; exit 1
fi
recovery_probe=/tmp/police-recovery-retired-$$.config
if docker exec "$container" /opt/keycloak/bin/kcadm.sh config credentials --server http://localhost:8080 \
    --realm master --user "$recovery_user" --password "$recovery_password" --config "$recovery_probe" >/dev/null 2>&1; then
    printf '%s\n' 'Temporary recovery credentials still authenticate after removal; investigate immediately.' >&2; exit 1
fi
docker exec "$container" rm -f "$bootstrap_probe" "$recovery_probe" >/dev/null 2>&1 || true

printf '%s\n' 'PASS: bootstrap account absent/disabled, its bootstrap secret replaced, and retired credentials rejected.'
printf '%s\n' 'PASS: temporary recovery admin removed and rejected; Keycloak/app healthy, owner MFA/role preconditions passed, public root remains 503.'
