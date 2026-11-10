#!/usr/bin/env python3
"""Read-only checks for the live production site after a rollout. No credential output.

Unlike verify-production.py (pre-cutover: maintenance and fixed source counts), this expects the
public site to be serving and only requires business data to be present."""
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request

DB_CONTAINER = 'police-production-candidate-db-20261105'
APP = 'http://127.0.0.1:18082'
STAGE = 'preflight'


def get(url, timeout=20):
    request = urllib.request.Request(url, headers={'Accept': 'application/json'})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as error:
        return error.code, error.read()


def curl(url):
    # The edge network rejects default Python user agents, so public routes use curl.
    result = subprocess.run(['curl', '-s', '--max-time', '20', '-w', '\n%{http_code}', url], capture_output=True)
    if result.returncode:
        return '000', b''
    body, _, code = result.stdout.rpartition(b'\n')
    return code.decode().strip(), body


def admin_sql(statement):
    result = subprocess.run(['docker', 'exec', '-i', DB_CONTAINER, 'bash', '-c',
        'export PGPASSWORD="$(cat /run/secrets/database_owner)"; '
        'exec psql -X -q -At -h 127.0.0.1 -U Monolithic -v ON_ERROR_STOP=1 -d Monolithic'],
        input=statement.encode(), capture_output=True)
    if result.returncode:
        raise RuntimeError('Database query failed')
    return result.stdout.decode().strip()


def run():
    global STAGE
    if os.geteuid() != 0:
        raise RuntimeError('Root required')
    STAGE = 'app-health'
    status, body = get(APP + '/management/health')
    assert status == 200 and json.loads(body)['status'] == 'UP'
    STAGE = 'no-synthetic-manifest'
    assert get(APP + '/staging-manifest.json')[0] == 404
    STAGE = 'anonymous-rbac'
    assert get(APP + '/api/rbac/me')[0] == 401
    STAGE = 'business-data-present'
    households = int(admin_sql('SELECT count(*) FROM public.household;'))
    residents = int(admin_sql('SELECT count(*) FROM public.resident;'))
    assert households > 0 and residents > 0
    STAGE = 'restricted-runtime-active'
    assert int(admin_sql("SELECT count(*) FROM pg_stat_activity WHERE datname='Monolithic' AND usename='police_runtime';")) > 0
    STAGE = 'public-site-serving'
    assert curl('https://sunnytech.cloud/')[0] == '200'
    assert curl('https://sunnytech.cloud/api/rbac/me')[0] == '401'
    assert curl('https://sunnytech.cloud/staging-manifest.json')[0] == '404'
    STAGE = 'public-realm-discovery'
    code, body = curl('https://sunnytech.cloud/realms/jhipster/.well-known/openid-configuration')
    assert code == '200' and json.loads(body)['issuer'] == 'https://sunnytech.cloud/realms/jhipster'
    print(json.dumps({'result': 'PRODUCTION_LIVE_VERIFY_PASS', 'backend_health': 'UP', 'public_root': 200,
                      'anonymous_rbac': 401, 'households': households, 'residents': residents,
                      'active_restricted_runtime': True, 'realm_discovery': True}))


if __name__ == '__main__':
    try:
        run()
    except Exception as error:
        print('PRODUCTION_LIVE_VERIFY_FAILED at ' + STAGE + ': ' + type(error).__name__, file=sys.stderr)
        sys.exit(1)
