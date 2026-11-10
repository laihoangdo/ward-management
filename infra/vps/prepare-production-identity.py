#!/usr/bin/env python3
"""Transform the exported source realm into the production realm.

Named operator with forced password reset + OTP enrollment, sample accounts disabled,
rotated service secret, production redirect URIs, brute-force protection.
No secret material is ever printed."""
import hashlib
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import tarfile
import tempfile
import uuid

ARCHIVE = Path('/var/backups/police-management/migration-source/identity-20261105T181353Z.tar.gz.gpg')
PASSPHRASE = Path('/etc/police-management/secrets/local_backup_passphrase')
OUT = Path('/etc/police-management/secrets/production')
REALM = 'jhipster'
SAMPLE = {'admin', 'user'}
OPERATOR = 'laihoangdo'
OPERATOR_EMAIL = 'laihoangdo0506@gmail.com'
STATE = Path('/var/lib/police-management/production-identity-20261107.json')
STAGE = 'preflight'


def run():
    global STAGE
    if os.geteuid() != 0:
        raise RuntimeError('Root required')
    os.umask(0o077)
    marker = json.loads(Path('/var/lib/police-management/production-candidate-20261105.json').read_text())
    if marker.get('result') != 'RESTORE_RECONCILED':
        raise RuntimeError('Candidate database is not reconciled')
    expected = Path(str(ARCHIVE) + '.sha256').read_text().split()[0]
    with ARCHIVE.open('rb') as stream:
        if hashlib.file_digest(stream, 'sha256').hexdigest() != expected:
            raise RuntimeError('Checksum mismatch')
    STAGE = 'decrypt-identity-archive'
    documents = []
    process = subprocess.Popen(['gpg', '--batch', '--pinentry-mode', 'loopback', '--passphrase-file',
        str(PASSPHRASE), '--decrypt', str(ARCHIVE)], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    with tarfile.open(fileobj=process.stdout, mode='r|gz') as archive:
        for member in archive:
            if not member.isfile() or member.size > 100 * 1024**2:
                raise RuntimeError('Invalid identity archive member')
            documents.append(json.load(archive.extractfile(member)))
    while process.stdout.read(1024**2):
        pass
    if process.wait() != 0:
        raise RuntimeError('Identity archive authentication failed')
    STAGE = 'transform-realm'
    realm = next(document for document in documents if document.get('realm') == REALM)
    users = realm.get('users', [])
    humans = [user for user in users if not user.get('serviceAccountClientId')]
    sample = [user for user in humans if user.get('username') in SAMPLE]
    other = [user for user in humans if user.get('username') not in SAMPLE]
    if len(humans) != 4 or len(sample) != 2 or len(other) != 2:
        raise RuntimeError('Unexpected identity inventory')
    for user in sample:
        user['enabled'] = False
        user['requiredActions'] = []
        user['credentials'] = []
    for user in other:
        actions = set(user.get('requiredActions') or [])
        user['requiredActions'] = sorted(actions | {'UPDATE_PASSWORD', 'CONFIGURE_OTP'})
        user['enabled'] = True
    operator_id = str(uuid.uuid4())
    temporary = secrets.token_urlsafe(24)
    realm['users'].append({
        'id': operator_id, 'username': OPERATOR, 'email': OPERATOR_EMAIL, 'emailVerified': True,
        'enabled': True, 'requiredActions': ['UPDATE_PASSWORD', 'CONFIGURE_OTP'],
        'credentials': [{'type': 'password', 'value': temporary, 'temporary': False}],
        'realmRoles': ['ROLE_USER', 'ROLE_ADMIN', 'ROLE_SUPERADMIN'],
    })
    clients = realm.get('clients', [])
    web = next(client for client in clients if client.get('clientId') == 'web_app')
    web['redirectUris'] = ['https://sunnytech.cloud/login/oauth2/code/oidc']
    web['webOrigins'] = ['https://sunnytech.cloud']
    # The app sends its origin as post_logout_redirect_uri; '+' (reuse redirect URIs) only allows the login callback.
    web.setdefault('attributes', {})['post.logout.redirect.uris'] = 'https://sunnytech.cloud'
    web['publicClient'] = True
    web['standardFlowEnabled'] = True
    web['directAccessGrantsEnabled'] = False
    rbac = next(client for client in clients if client.get('clientId') == 'rbac-admin')
    rbac_secret = secrets.token_urlsafe(48)
    rbac['secret'] = rbac_secret
    rbac['publicClient'] = False
    rbac['directAccessGrantsEnabled'] = False
    rbac['serviceAccountsEnabled'] = True
    realm['enabled'] = True
    # Local exports carry a dev frontendUrl; force the production hostname so the
    # issuer matches the public route and Keycloak strict hostname accepts requests.
    realm.setdefault('attributes', {})['frontendUrl'] = 'https://sunnytech.cloud'
    realm['registrationAllowed'] = False
    realm['resetPasswordAllowed'] = False
    realm['rememberMe'] = False
    realm['verifyEmail'] = False
    realm['sslRequired'] = 'external'
    realm['bruteForceProtected'] = True
    realm['failureFactor'] = 10
    realm['waitIncrementSeconds'] = 60
    realm['minimumQuickLoginWaitSeconds'] = 60
    realm['maxFailureWaitSeconds'] = 900
    realm['quickLoginCheckMilliSeconds'] = 1000
    realm['permanentLockout'] = False
    realm.pop('smtpServer', None)
    STAGE = 'write-production-secrets'
    OUT.mkdir(mode=0o700, parents=True)
    realm_file = OUT / 'realm.json'
    realm_file.write_text(json.dumps(realm))
    realm_file.chmod(0o600)
    operator_file = OUT / 'operator-initial'
    operator_file.write_text(temporary + '\n')
    operator_file.chmod(0o600)
    secret_file = OUT / 'rbac_client_secret'
    secret_file.write_text(rbac_secret + '\n')
    secret_file.chmod(0o600)
    state = {'result': 'PRODUCTION_REALM_PREPARED', 'operatorSubject': operator_id,
             'sampleAccountsDisabled': len(sample), 'humansForcedResetAndOtp': len(other),
             'rotatedClients': ['rbac-admin'], 'webAppRedirect': 'https://sunnytech.cloud/login/oauth2/code/oidc'}
    STATE.write_text(json.dumps(state))
    STATE.chmod(0o600)
    print(json.dumps(state))


if __name__ == '__main__':
    try:
        run()
    except Exception as error:
        print('FAIL at ' + STAGE + ': ' + type(error).__name__ + '; private output suppressed.', file=sys.stderr)
        sys.exit(1)
