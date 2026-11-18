#!/usr/bin/env python3
"""Audit live staging policy, test lockout, and disable the synthetic gate identity/client."""
import importlib.util
import json
import os
import secrets
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path('/etc/police-management/secrets/staging')
INTERNAL = 'http://127.0.0.1:18080'

class AuditError(Exception):
    pass

def check(condition, message):
    if not condition:
        raise AuditError(message)

def request(path, method='GET', body=None, token=None, form=False):
    headers = {'Host': 'sunnytech.cloud', 'X-Forwarded-Proto': 'https', 'X-Forwarded-Port': '443'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    payload = None
    if body is not None:
        headers['Content-Type'] = 'application/x-www-form-urlencoded' if form else 'application/json'
        payload = (urllib.parse.urlencode(body) if form else json.dumps(body)).encode()
    req = urllib.request.Request(INTERNAL + path, method=method, data=payload, headers=headers)
    try:
        response = urllib.request.urlopen(req, timeout=20)
    except urllib.error.HTTPError:
        raise AuditError('Internal admin API rejected request (details redacted)') from None
    raw = response.read()
    return json.loads(raw) if raw else None

def run():
    check(os.geteuid() == 0, 'Run via sudo')
    access = request('/realms/master/protocol/openid-connect/token', method='POST', form=True,
        body={'grant_type': 'password', 'client_id': 'admin-cli', 'username': 'staging-bootstrap',
              'password': (ROOT / 'keycloak_bootstrap').read_text()})['access_token']
    api = '/admin/realms/police-staging'
    service = request('/realms/police-staging/protocol/openid-connect/token', method='POST', form=True,
        body={'grant_type': 'client_credentials', 'client_id': 'rbac-admin',
              'client_secret': (ROOT / 'rbac_client').read_text()})['access_token']
    check(isinstance(request(api + '/users?max=1', token=service), list), 'Backend service account cannot read its realm')
    headers = {'Host': 'sunnytech.cloud', 'X-Forwarded-Proto': 'https', 'X-Forwarded-Port': '443',
               'Content-Type': 'application/x-www-form-urlencoded'}
    synthetic = json.loads((ROOT / 'mfa-gate.json').read_text())
    form = {'grant_type': 'password', 'client_id': 'web_app', 'client_secret': (ROOT / 'web_client').read_text(),
            'username': synthetic['username'], 'password': synthetic['password']}
    rejected = False
    try:
        response = urllib.request.urlopen(urllib.request.Request(INTERNAL + '/realms/police-staging/protocol/openid-connect/token',
            data=urllib.parse.urlencode(form).encode(), headers=headers), timeout=20)
        response.close()
    except urllib.error.HTTPError as error:
        rejected = error.code == 400 and json.loads(error.read()).get('error') == 'unauthorized_client'
    check(rejected, 'Web application password grant is not rejected at client policy')
    policy = request(api, token=access)
    for field, expected in {'browserFlow': 'police-browser-mfa', 'sslRequired': 'all',
        'bruteForceProtected': True, 'permanentLockout': False, 'failureFactor': 5,
        'accessTokenLifespan': 300, 'ssoSessionIdleTimeout': 900, 'ssoSessionMaxLifespan': 28800,
        'registrationAllowed': False, 'rememberMe': False, 'eventsEnabled': True,
        'adminEventsEnabled': True, 'adminEventsDetailsEnabled': False}.items():
        check(policy.get(field) == expected, 'Live policy mismatch: ' + field)
    executions = request(api + '/authentication/flows/police-forms-mfa/executions', token=access)
    check(any(item.get('providerId') == 'auth-otp-form' and item.get('requirement') == 'REQUIRED' for item in executions), 'OTP execution is not REQUIRED')
    actions = request(api + '/authentication/required-actions', token=access)
    check(any(item.get('alias') == 'CONFIGURE_TOTP' and item.get('enabled') and item.get('defaultAction') for item in actions), 'OTP enrollment is not required by default')
    clients = request(api + '/clients', token=access)
    for client_id in ['web_app', 'mfa-gate', 'rbac-admin']:
        client = next((item for item in clients if item['clientId'] == client_id), None)
        check(client is not None and not client.get('directAccessGrantsEnabled', False), 'Password grant bypass enabled: ' + client_id)
    users = request(api + '/users?username=synthetic-mfa-gate&exact=true', token=access)
    check(len(users) == 1 and users[0]['username'] == 'synthetic-mfa-gate', 'Synthetic identity not found uniquely')
    user_id = users[0]['id']
    stored = request(api + '/users/' + user_id + '/credentials', token=access)
    check(any(item.get('type') == 'otp' for item in stored), 'OTP enrollment was not persisted')
    spec = importlib.util.spec_from_file_location('mfa_gate', Path(__file__).with_name('test-mfa.py'))
    gate = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(gate)
    lockout = 'SKIPPED_ALREADY_DISABLED'
    if users[0].get('enabled'):
        for _ in range(6):
            session = gate.Session()
            _, _, status, url, html = gate.authorize(session)
            check(status == 200, 'Lockout login page unavailable')
            _, url, _ = gate.submit(session, gate.Forms(html).with_field('password'),
                {'username': 'synthetic-mfa-gate', 'password': secrets.token_urlsafe(32)})
            gate.no_code(url)
        brute = request(api + '/attack-detection/brute-force/users/' + user_id, token=access)
        check(brute.get('disabled') is True, 'Repeated bad passwords did not temporarily disable account')
        lockout = 'PASS'
    # Only owned synthetic objects are disabled. Real operators/bootstrap identity are not changed.
    request(api + '/users/' + user_id + '/logout', method='POST', token=access)
    request(api + '/users/' + user_id, method='PUT', body={'enabled': False}, token=access)
    mfa_client = next(item for item in clients if item['clientId'] == 'mfa-gate')
    request(api + '/clients/' + mfa_client['id'], method='PUT', body={'enabled': False}, token=access)
    check(request(api + '/users/' + user_id, token=access).get('enabled') is False, 'Synthetic identity still enabled')
    check(request(api + '/clients/' + mfa_client['id'], token=access).get('enabled') is False, 'Synthetic client still enabled')
    # Keep a future clean DB/import from recreating an enabled gate identity/client.
    realm_file = ROOT / 'realm.json'
    imported = json.loads(realm_file.read_text())
    imported['users'] = [item for item in imported.get('users', []) if item.get('username') != 'synthetic-mfa-gate']
    imported['clients'] = [item for item in imported.get('clients', []) if item.get('clientId') != 'mfa-gate']
    temporary = ROOT / ('.realm-sanitized-' + secrets.token_hex(8))
    with temporary.open('x') as stream:
        json.dump(imported, stream)
    temporary.chmod(0o444)
    temporary.replace(realm_file)
    print(json.dumps({'live_policy': 'PASS', 'backend_service_account': True, 'password_grant_rejected': True,
        'required_otp_execution': True, 'persisted_otp': True,
        'password_grant_disabled': True, 'brute_force_lockout': lockout,
        'synthetic_user_disabled': True, 'synthetic_client_disabled': True, 'import_fixture_sanitized': True}))

if __name__ == '__main__':
    try:
        run()
    except AuditError as error:
        print('STAGING_AUDIT_FAILED: ' + str(error))
        raise SystemExit(1)
    except Exception as error:
        print('STAGING_AUDIT_FAILED: ' + type(error).__name__)
        # Do not print upstream representations, URLs, secrets or tokens.
        raise SystemExit(1)
