#!/usr/bin/env bash
# Provision the named first administrator (owner-approved identity: laihoangdo).
# The human changes the password and enrolls MFA personally; the initial secret
# is written once to a root-only file on the VPS, never printed or sent anywhere.
set -euo pipefail
umask 077
[[ ${EUID} -eq 0 ]] || exit 1
container=police-staging-keycloak-1
app_realm=police-staging
username=laihoangdo
email=laihoangdo0506@gmail.com
secrets=/etc/police-management/secrets/staging
initial=$secrets/admin-laihoangdo-initial
server=http://localhost:8080
[[ -d "$secrets" ]] || { echo 'Secrets directory missing' >&2; exit 1; }
[[ ! -e "$initial" ]] || { echo 'Initial credential file already exists; review instead of regenerating.' >&2; exit 1; }
docker inspect "$container" >/dev/null 2>&1 || { echo 'Keycloak container not running' >&2; exit 1; }
# kcadm resolves its session file from the container user's home (not $HOME),
# which is not writable; --config is only accepted after the subcommand.
run_kcadm() {
    docker exec "$container" /opt/keycloak/bin/kcadm.sh "$@" --config /tmp/police-kcadm.config
}
cleanup_kcadm() {
    docker exec "$container" rm -f /tmp/police-kcadm.config >/dev/null 2>&1 || true
}
trap cleanup_kcadm EXIT
bootstrap_password=$(docker exec "$container" cat /run/secrets/keycloak_bootstrap)
run_kcadm config credentials --server "$server" --realm master --user staging-bootstrap --password "$bootstrap_password" >/dev/null
# grep -q in a pipeline exits early and SIGPIPEs the producer under pipefail;
# capture the output and match with case instead.
realm_roles=$(run_kcadm get roles -r "$app_realm" --fields name)
case "$realm_roles" in
    *ROLE_SUPERADMIN*) ;;
    *) echo 'ROLE_SUPERADMIN missing in police-staging realm; review realm import first.' >&2; exit 1 ;;
esac
for realm in "$app_realm" master; do
    existing=$(run_kcadm get users -r "$realm" -q username="$username" --fields id 2>/dev/null | grep -c '"id"' || true)
    [[ "$existing" == 0 ]] || { echo "User already exists in realm $realm; review instead of recreating." >&2; exit 1; }
done
password=$(openssl rand -hex 20)
printf '%s\n' "$password" > "$initial"
chmod 0600 "$initial"
chown root:root "$initial"
# Application realm administrator (drives the app's superadmin role mapping).
run_kcadm create users -r "$app_realm" -s username="$username" -s enabled=true -s email="$email" -s emailVerified=true -s 'requiredActions=["UPDATE_PASSWORD","CONFIGURE_OTP"]' >/dev/null
app_id=$(run_kcadm get users -r "$app_realm" -q username="$username" --fields id --format csv --noquotes | tail -n 1)
run_kcadm set-password -r "$app_realm" --userid "$app_id" --new-password "$password" --temporary >/dev/null
run_kcadm add-roles -r "$app_realm" --uid "$app_id" --rolename ROLE_SUPERADMIN
# Master realm administrator for the management console; replaces staging-bootstrap after owner confirmation.
run_kcadm create users -r master -s username="$username" -s enabled=true -s email="$email" -s emailVerified=true -s 'requiredActions=["UPDATE_PASSWORD","CONFIGURE_OTP"]' >/dev/null
master_id=$(run_kcadm get users -r master -q username="$username" --fields id --format csv --noquotes | tail -n 1)
run_kcadm set-password -r master --userid "$master_id" --new-password "$password" --temporary >/dev/null
# Keycloak 26 normalizes CONFIGURE_OTP to CONFIGURE_TOTP and may drop the
# action at create time in master; set it explicitly so MFA is mandatory.
run_kcadm update "users/$master_id" -r master -s 'requiredActions=["UPDATE_PASSWORD","CONFIGURE_TOTP"]' >/dev/null
run_kcadm add-roles -r master --uid "$master_id" --rolename admin
# Verify provisioning without printing any secret.
app_user=$(run_kcadm get users -r "$app_realm" -q username="$username" --fields requiredActions)
case "$app_user" in *UPDATE_PASSWORD*) ;; *) echo 'UPDATE_PASSWORD missing in police-staging' >&2; exit 1 ;; esac
case "$app_user" in *CONFIGURE_TOTP*|*CONFIGURE_OTP*) ;; *) echo 'OTP enrollment action missing in police-staging' >&2; exit 1 ;; esac
app_roles=$(run_kcadm get "users/$app_id/role-mappings/realm" -r "$app_realm")
case "$app_roles" in *'"name" : "ROLE_SUPERADMIN"'*|*'"name":"ROLE_SUPERADMIN"'*) ;; *) echo 'ROLE_SUPERADMIN missing in police-staging' >&2; exit 1 ;; esac
master_user=$(run_kcadm get users -r master -q username="$username" --fields requiredActions)
case "$master_user" in *CONFIGURE_TOTP*|*CONFIGURE_OTP*) ;; *) echo 'OTP enrollment action missing in master' >&2; exit 1 ;; esac
master_roles=$(run_kcadm get "users/$master_id/role-mappings/realm" -r master)
case "$master_roles" in *'"name" : "admin"'*|*'"name":"admin"'*) ;; *) echo 'admin role missing in master' >&2; exit 1 ;; esac
printf '%s\n' 'PASS: named administrator provisioned in police-staging (ROLE_SUPERADMIN) and master realms; both force password change and OTP enrollment.'
printf '%s\n' "Initial password written once to $initial (root-only). Never print, copy or transmit it."
printf '%s\n' 'Owner steps: read the file over SSH yourself, sign in at https://sunnytech.cloud/realms/police-staging/account and the master console, change both passwords, enroll OTP on both, then confirm so staging-bootstrap can be retired.'
