#!/usr/bin/env python3
"""Read-only acceptance checks for the synthetic backend; no credential output."""
import importlib.util
import json
from pathlib import Path
import urllib.error
import urllib.request

spec = importlib.util.spec_from_file_location('drill', Path(__file__).with_name('restore-drill.py'))
drill = importlib.util.module_from_spec(spec)
spec.loader.exec_module(drill)

def get(path):
    request = urllib.request.Request('http://127.0.0.1:18081' + path, headers={'Accept': 'application/json'})
    try:
        result = urllib.request.urlopen(request, timeout=20)
        return result.status, result.read()
    except urllib.error.HTTPError as error:
        return error.code, error.read()

def run():
    status, body = get('/management/health')
    assert status == 200 and json.loads(body)['status'] == 'UP'
    status, body = get('/staging-manifest.json')
    assert status == 200 and json.loads(body)['syntheticOnly'] is True
    assert get('/api/rbac/me')[0] == 401
    assert get('/')[0] == 200
    assert drill.sql('Monolithic', 'select count(*) from public.household;') == '0'
    assert drill.sql('Monolithic', 'select count(*) from public.resident;') == '0'
    assert drill.sql('Monolithic', "select count(*) from databasechangelog where contexts like '%faker%';") == '0'
    assert int(drill.sql('Monolithic', "select count(*) from pg_stat_activity where datname='Monolithic' and usename='police_runtime';")) > 0
    assert drill.sql('Monolithic', "select not (rolsuper or rolcreatedb or rolcreaterole or rolbypassrls) from pg_roles where rolname='police_runtime';") == 't'
    print(json.dumps({'backend_health': 'UP', 'frontend_index': 200, 'synthetic_manifest': True,
        'anonymous_rbac': 401, 'households': 0, 'residents': 0, 'faker_changesets': 0,
        'active_restricted_runtime': True, 'public_go_live': False}))

if __name__ == '__main__':
    try:
        run()
    except Exception as error:
        print('STAGING_APP_VERIFY_FAILED: ' + type(error).__name__)
        raise SystemExit(1)
