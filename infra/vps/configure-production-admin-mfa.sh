#!/usr/bin/env bash
# Require OTP for administrators (ROLE_ADMIN: commune chief and super admin) in production realm `jhipster`.
#
# Copies the realm's built-in `browser` flow to `police-browser-admin-mfa`:
#   - existing "Conditional OTP" sub-flow (user already configured OTP) gains "user role != ROLE_ADMIN",
#   - new "Admin OTP" sub-flow: "user role == ROLE_ADMIN" -> OTP Form REQUIRED (forces enrollment when missing),
# so an administrator is asked for OTP exactly once and other users keep today's behaviour.
# Admin API access uses a short-lived master admin created with Keycloak's official offline
# `bootstrap-admin` command (Keycloak is stopped for about a minute) and always removed again.
# Rollback: set realm `jhipster` browserFlow back to `browser` (the original flow is never modified).
set -euo pipefail
umask 077
[[ ${EUID} -eq 0 ]] || { printf '%s\n' 'Run via sudo.' >&2; exit 1; }
exec 9>/run/lock/police-admin-mfa.lock
flock -n 9 || { printf '%s\n' 'Admin MFA configuration is already running.' >&2; exit 1; }

compose=/opt/police-management/staging/compose.yml
container=police-staging-keycloak-1
realm=jhipster
flow=police-browser-admin-mfa
config=/tmp/police-admin-mfa-$$.config
recovery_user="mfa-config-$(date -u +%Y%m%d%H%M%S)-$(openssl rand -hex 3)"
recovery_password=$(openssl rand -hex 32)
keycloak_stopped=0
recovery_created=0
recovery_removed=0
step=prechecks

wait_keycloak() {
    for _ in $(seq 1 90); do
        if docker logs --tail 200 "$container" 2>&1 | grep -q 'Bootstrap completed in\|started in'; then
            [[ $(docker inspect --format '{{.State.Health.Status}}' "$container" 2>/dev/null) == healthy ]] && return 0
        fi
        sleep 2
    done
    return 1
}
kcadm() { docker exec "$container" /opt/keycloak/bin/kcadm.sh "$@" --config "$config"; }
login() {
    for _ in 1 2 3 4 5; do
        kcadm config credentials --server http://localhost:8080 --realm master \
            --user "$recovery_user" --password "$recovery_password" >/dev/null 2>&1 && return 0
        sleep 3
    done
    return 1
}
json() { python3 -c "import json,sys; d=json.load(sys.stdin); $1"; }

cleanup() {
    result=$?
    trap - EXIT HUP INT TERM
    (( result == 0 )) || printf 'Admin MFA configuration stopped at stage: %s.\n' "$step" >&2
    if (( keycloak_stopped )); then
        docker compose -f "$compose" up -d --wait --wait-timeout 300 keycloak >/dev/null 2>&1 && wait_keycloak && keycloak_stopped=0 \
            || { printf '%s\n' 'Keycloak did not restart during cleanup; restart it now.' >&2; result=1; }
    fi
    if (( recovery_created && ! recovery_removed && ! keycloak_stopped )); then
        if login; then
            id=$(kcadm get users -r master -q "username=$recovery_user" --fields id 2>/dev/null | json 'print(d[0]["id"] if len(d)==1 else "")' || true)
            [[ -n "$id" ]] && kcadm delete "users/$id" -r master >/dev/null 2>&1 && recovery_removed=1
        fi
        (( recovery_removed )) || { printf '%s\n' 'WARNING: temporary admin may remain in realm master; remove it now.' >&2; result=1; }
    fi
    docker exec "$container" rm -f "$config" >/dev/null 2>&1 || true
    unset recovery_password KC_RECOVERY_PASSWORD
    exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

[[ $(docker inspect --format '{{.State.Health.Status}}' "$container") == healthy ]] || { printf '%s\n' 'Keycloak must be healthy first.' >&2; exit 1; }
docker compose -f "$compose" config --quiet

# 1. Temporary admin through the official offline command (all Keycloak nodes must be stopped).
step=temporary-admin
docker compose -f "$compose" stop keycloak >/dev/null
keycloak_stopped=1
export KC_RECOVERY_PASSWORD="$recovery_password"
docker compose -f "$compose" run --rm --no-deps -e KC_RECOVERY_PASSWORD keycloak \
    bootstrap-admin user --username "$recovery_user" --password:env KC_RECOVERY_PASSWORD --no-prompt >/dev/null 2>&1
recovery_created=1
unset KC_RECOVERY_PASSWORD
docker compose -f "$compose" up -d --wait --wait-timeout 300 keycloak >/dev/null
wait_keycloak
keycloak_stopped=0
login

# 2. Build the flow on a copy; the realm keeps using `browser` until the final switch.
step=copy-flow
if ! kcadm get authentication/flows -r "$realm" | json "raise SystemExit(0 if any(f['alias']=='$flow' for f in d) else 1)"; then
    kcadm create authentication/flows/browser/copy -r "$realm" -s "newName=$flow" >/dev/null
fi
executions=$(kcadm get "authentication/flows/$flow/executions" -r "$realm")
forms=$(printf '%s' "$executions" | json "print(next(e['displayName'] for e in d if e.get('authenticationFlow') and e['displayName'].endswith('forms')))")
generic=$(printf '%s' "$executions" | json "print(next(e['displayName'] for e in d if e.get('authenticationFlow') and 'Conditional OTP' in e['displayName']))")
add_role_condition() { # $1 sub-flow alias, $2 negate
    local id
    kcadm create "authentication/flows/$1/executions/execution" -r "$realm" -s provider=conditional-user-role >/dev/null
    id=$(kcadm get "authentication/flows/$1/executions" -r "$realm" | json "print([e['id'] for e in d if e.get('providerId')=='conditional-user-role' and e.get('level')==0][-1])")
    kcadm update "authentication/flows/$1/executions" -r "$realm" -b "{\"id\":\"$id\",\"requirement\":\"REQUIRED\"}" >/dev/null
    kcadm create "authentication/executions/$id/config" -r "$realm" \
        -b "{\"alias\":\"police-admin-role-$2-$(openssl rand -hex 3)\",\"config\":{\"condUserRole\":\"ROLE_ADMIN\",\"negate\":\"$2\"}}" >/dev/null
}

step=exclude-admins-from-optional-otp
if ! kcadm get "authentication/flows/$generic/executions" -r "$realm" | json "raise SystemExit(0 if any(e.get('providerId')=='conditional-user-role' for e in d) else 1)"; then
    add_role_condition "$generic" true
fi

step=admin-otp-subflow
admin_flow="$flow Admin OTP"
if ! printf '%s' "$(kcadm get "authentication/flows/$flow/executions" -r "$realm")" | json "raise SystemExit(0 if any(e.get('displayName')=='$admin_flow' for e in d) else 1)"; then
    kcadm create "authentication/flows/$forms/executions/flow" -r "$realm" \
        -b "{\"alias\":\"$admin_flow\",\"type\":\"basic-flow\",\"provider\":\"registration-page-form\",\"description\":\"OTP required for ROLE_ADMIN\"}" >/dev/null
    id=$(kcadm get "authentication/flows/$flow/executions" -r "$realm" | json "print(next(e['id'] for e in d if e.get('displayName')=='$admin_flow'))")
    kcadm update "authentication/flows/$forms/executions" -r "$realm" -b "{\"id\":\"$id\",\"requirement\":\"CONDITIONAL\"}" >/dev/null
    add_role_condition "$admin_flow" false
    kcadm create "authentication/flows/$admin_flow/executions/execution" -r "$realm" -s provider=auth-otp-form >/dev/null
    id=$(kcadm get "authentication/flows/$admin_flow/executions" -r "$realm" | json "print(next(e['id'] for e in d if e.get('providerId')=='auth-otp-form'))")
    kcadm update "authentication/flows/$admin_flow/executions" -r "$realm" -b "{\"id\":\"$id\",\"requirement\":\"REQUIRED\"}" >/dev/null
fi

# 3. Verify the structure before switching the realm to it.
step=verify-flow
kcadm get "authentication/flows/$flow/executions" -r "$realm" | json "
rows=[(e.get('level'),e.get('displayName'),e.get('providerId'),e.get('requirement')) for e in d]
admin=[r for r in rows if r[1]=='$admin_flow']
assert admin and admin[0][3]=='CONDITIONAL', 'admin sub-flow missing or not conditional'
assert sum(1 for r in rows if r[2]=='conditional-user-role' and r[3]=='REQUIRED')==2, 'role conditions missing'
assert sum(1 for r in rows if r[2]=='auth-otp-form' and r[3]=='REQUIRED')==2, 'OTP forms missing'
assert any(r[2]=='auth-username-password-form' and r[3]=='REQUIRED' for r in rows), 'password form missing'
for r in rows: print('  '*int(r[0] or 0)+str(r[1])+' ['+str(r[3])+']')
"
step=bind-flow
kcadm update "realms/$realm" -s "browserFlow=$flow" >/dev/null
[[ $(kcadm get "realms/$realm" --fields browserFlow | json "print(d['browserFlow'])") == "$flow" ]]

# 4. Remove the temporary admin and prove it no longer authenticates.
step=remove-temporary-admin
id=$(kcadm get users -r master -q "username=$recovery_user" --fields id | json 'print(d[0]["id"] if len(d)==1 else "")')
[[ -n "$id" ]]
kcadm delete "users/$id" -r master >/dev/null
recovery_removed=1
if login; then printf '%s\n' 'Temporary admin still authenticates; investigate.' >&2; exit 1; fi
step=verify-public
[[ $(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "https://sunnytech.cloud/realms/$realm/.well-known/openid-configuration") == 200 ]]
printf '%s\n' "ADMIN_MFA_CONFIGURED realm=$realm browserFlow=$flow temporaryAdminRemoved=true"
