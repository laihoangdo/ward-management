#!/usr/bin/env python3
"""One-time staging setup. Secrets stay in a root-only host directory, never stdout."""
import json
import os
import secrets
from pathlib import Path

if os.geteuid() != 0:
    raise SystemExit("Run via sudo")
root = Path("/etc/police-management/secrets/staging")
if root.exists():
    raise SystemExit("Staging secrets already exist; explicit review required, no rotation performed")
root.mkdir(mode=0o700)

def write(name, value):
    # Compose file-backed secrets keep host permissions. Container UID 1000 must read mounted files;
    # the host parent is 0700 root:root and only explicitly selected files enter each container.
    with (root / name).open("x") as stream:
        stream.write(value)
    (root / name).chmod(0o444)

for name in ("database_owner", "keycloak_database", "keycloak_bootstrap", "web_client", "rbac_client"):
    write(name, secrets.token_hex(32))
password = secrets.token_urlsafe(32)
write("mfa-gate.json", json.dumps({"username": "synthetic-mfa-gate", "password": password}))
roles = ["ROLE_USER", "ROLE_ADMIN", "ROLE_SUB_ADMIN", "ROLE_SUPERADMIN"]
realm = {
    "realm": "police-staging", "enabled": True, "displayName": "Police staging - synthetic only",
    "sslRequired": "all", "registrationAllowed": False, "rememberMe": False,
    "resetPasswordAllowed": False, "loginWithEmailAllowed": False,
    "bruteForceProtected": True, "permanentLockout": False, "failureFactor": 5,
    "waitIncrementSeconds": 60, "maxFailureWaitSeconds": 900, "maxDeltaTimeSeconds": 900,
    "minimumQuickLoginWaitSeconds": 60, "quickLoginCheckMilliSeconds": 1000,
    "accessTokenLifespan": 300, "ssoSessionIdleTimeout": 900, "ssoSessionMaxLifespan": 28800,
    "otpPolicyType": "totp", "otpPolicyAlgorithm": "HmacSHA1", "otpPolicyDigits": 6,
    "otpPolicyPeriod": 30, "otpPolicyLookAheadWindow": 1,
    "eventsEnabled": True, "eventsExpiration": 2592000,
    "eventsListeners": ["jboss-logging"], "adminEventsEnabled": True, "adminEventsDetailsEnabled": False,
    "roles": {"realm": [{"name": name} for name in roles]},
    "browserFlow": "police-browser-mfa",
    "authenticationFlows": [
        {"alias": "police-browser-mfa", "providerId": "basic-flow", "topLevel": True, "builtIn": False,
         "authenticationExecutions": [
             {"authenticator": "auth-cookie", "requirement": "ALTERNATIVE", "priority": 10, "userSetupAllowed": False, "authenticatorFlow": False},
             {"flowAlias": "police-forms-mfa", "requirement": "ALTERNATIVE", "priority": 20, "userSetupAllowed": False, "authenticatorFlow": True}]},
        {"alias": "police-forms-mfa", "providerId": "basic-flow", "topLevel": False, "builtIn": False,
         "authenticationExecutions": [
             {"authenticator": "auth-username-password-form", "requirement": "REQUIRED", "priority": 10, "userSetupAllowed": False, "authenticatorFlow": False},
             {"authenticator": "auth-otp-form", "requirement": "REQUIRED", "priority": 20, "userSetupAllowed": False, "authenticatorFlow": False}]}
    ],
    "requiredActions": [{"alias": "CONFIGURE_TOTP", "name": "Configure OTP", "providerId": "CONFIGURE_TOTP", "enabled": True, "defaultAction": True, "priority": 10}],
    "clients": [
        {"clientId": "web_app", "enabled": True, "protocol": "openid-connect", "publicClient": False,
         "secret": (root / "web_client").read_text(), "standardFlowEnabled": True,
         "directAccessGrantsEnabled": False,
         "redirectUris": ["https://sunnytech.cloud/login/oauth2/code/oidc"],
         "webOrigins": ["https://sunnytech.cloud"], "defaultClientScopes": ["profile", "email", "roles"],
         "attributes": {"post.logout.redirect.uris": "https://sunnytech.cloud/"},
         "protocolMappers": [{"name": "realm roles", "protocol": "openid-connect", "protocolMapper": "oidc-usermodel-realm-role-mapper",
                              "config": {"claim.name": "roles", "jsonType.label": "String", "multivalued": "true", "id.token.claim": "true", "access.token.claim": "true", "userinfo.token.claim": "true"}}]},
        {"clientId": "rbac-admin", "enabled": True, "protocol": "openid-connect", "publicClient": False,
         "secret": (root / "rbac_client").read_text(), "standardFlowEnabled": False,
         "directAccessGrantsEnabled": False, "serviceAccountsEnabled": True},
        {"clientId": "mfa-gate", "enabled": True, "protocol": "openid-connect", "publicClient": True,
         "standardFlowEnabled": True, "directAccessGrantsEnabled": False,
         "redirectUris": ["https://sunnytech.cloud/mfa-gate-callback"],
         "defaultClientScopes": ["profile", "email"], "attributes": {"pkce.code.challenge.method": "S256"}}
    ],
    "users": [
        {"username": "synthetic-mfa-gate", "enabled": True, "emailVerified": True,
         "firstName": "Synthetic", "lastName": "MFA gate", "email": "synthetic@example.invalid",
         "credentials": [{"type": "password", "value": password, "temporary": False}],
         "requiredActions": ["CONFIGURE_TOTP"], "realmRoles": ["ROLE_USER"]},
        {"username": "service-account-rbac-admin", "enabled": True, "serviceAccountClientId": "rbac-admin",
         "clientRoles": {"realm-management": ["view-users", "query-users", "manage-users", "view-realm"]}}
    ]
}
write("realm.json", json.dumps(realm))
write("SYNTHETIC_ONLY", "No production identities or citizen data. Offsite recovery not approved.\n")
print("Created staging secrets/realm; no values printed. No existing credentials overwritten.")
