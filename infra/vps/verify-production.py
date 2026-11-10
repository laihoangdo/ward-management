#!/usr/bin/env python3
"""Read-only production acceptance checks before the public cutover. No credential output.

Public-route checks use curl: the edge network rejects default Python user agents,
while the application itself is checked over loopback."""
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request

DB_CONTAINER = 'police-production-candidate-db-20261105'
STAGE = 'preflight'


def get(url, timeout=20):
    request = urllib.request.Request(url, headers={'Accept': 'application/json'})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as error:
        return error.code, error.read()


def curl(url, resolve=None):
    args = ['curl', '-s', '--max-time', '20', '-w', '\n%{http_code}']
    if resolve:
        args += ['--resolve', resolve, '--cacert',
                 '/etc/letsencrypt/live/sunnytech.cloud/fullchain.pem']
    result = subprocess.run(args + [url], capture_output=True)
    if result.returncode:
        return '000', b''
    body, _, code = result.stdout.rpartition(b'\n')
    return code.decode().strip(), body


def admin_sql(statement, database='Monolithic'):
    result = subprocess.run(['sudo', '-n', 'docker', 'exec', '-i', DB_CONTAINER, 'bash', '-c',
        'export PGPASSWORD="$(cat /run/secrets/database_owner)"; '
        'exec psql -X -q -At -h 127.0.0.1 -U Monolithic -v ON_ERROR_STOP=1 -d ' + database],
        input=statement.encode(), capture_output=True)
    if result.returncode:
        raise RuntimeError('Candidate query failed')
    return result.stdout.decode().strip()


def run():
    global STAGE
    if os.geteuid() != 0:
        raise RuntimeError('Root required')
    STAGE = 'app-health'
    status, body = get('http://127.0.0.1:18082/management/health')
    assert status == 200 and json.loads(body)['status'] == 'UP'
    STAGE = 'frontend-index'
    assert get('http://127.0.0.1:18082/')[0] == 200
    STAGE = 'no-synthetic-manifest'
    assert get('http://127.0.0.1:18082/staging-manifest.json')[0] == 404
    STAGE = 'anonymous-rbac'
    assert get('http://127.0.0.1:18082/api/rbac/me')[0] == 401
    STAGE = 'candidate-data'
    assert admin_sql('SELECT count(*) FROM public.household;') == '1291'
    assert admin_sql('SELECT count(*) FROM public.resident;') == '5074'
    STAGE = 'restricted-runtime-active'
    assert int(admin_sql("SELECT count(*) FROM pg_stat_activity WHERE datname='Monolithic' AND usename='police_runtime';")) > 0
    STAGE = 'public-realm-discovery'
    code, body = curl('https://sunnytech.cloud/realms/jhipster/.well-known/openid-configuration')
    assert code == '200' and json.loads(body)['issuer'] == 'https://sunnytech.cloud/realms/jhipster'
    STAGE = 'internal-rbac-issuer'
    # Check from the application's network namespace so the source address matches
    # the gateway allow-list exactly as the application's own admin calls appear.
    pid = subprocess.run(['sudo', '-n', 'docker', 'inspect', 'police-production-app-1',
                          '--format', '{{.State.Pid}}'], capture_output=True)
    result = subprocess.run(['sudo', '-n', 'nsenter', '-t', pid.stdout.decode().strip(), '-n',
        'curl', '-s', '-o', '/dev/null', '-w', '%{http_code}', '--max-time', '20',
        '--resolve', 'sunnytech.cloud:18443:172.29.41.1',
        '--cacert', '/etc/letsencrypt/live/sunnytech.cloud/fullchain.pem',
        'https://sunnytech.cloud:18443/admin/realms/jhipster/users?max=1'],
        capture_output=True)
    if result.returncode or result.stdout.decode().strip() != '401':
        raise RuntimeError('Internal rbac gateway not enforcing admin auth')
    STAGE = 'maintenance-still-active'
    code, _ = curl('https://sunnytech.cloud/')
    assert code == '503'
    print(json.dumps({'backend_health': 'UP', 'frontend_index': 200, 'synthetic_manifest': False,
                      'anonymous_rbac': 401, 'households': 1291, 'residents': 5074,
                      'active_restricted_runtime': True, 'realm_discovery': True,
                      'rbac_issuer_reachable': True, 'public_go_live': False}))


if __name__ == '__main__':
    try:
        run()
    except Exception as error:
        print('PRODUCTION_VERIFY_FAILED at ' + STAGE + ': ' + type(error).__name__, file=sys.stderr)
        sys.exit(1)
