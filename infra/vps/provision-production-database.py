#!/usr/bin/env python3
"""Provision the restricted runtime role inside the production candidate; no other change."""
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys

CONTAINER = 'police-production-candidate-db-20261105'
SECRET = Path('/etc/police-management/secrets/production')
SQL = Path('/opt/police-management/staging/database-runtime-role.sql')
STATE = Path('/var/lib/police-management/production-candidate-20261105.json')
STAGE = 'preflight'


def checked(args, data=None, expect_failure=False):
    result = subprocess.run(args, input=data, capture_output=True)
    if expect_failure:
        if result.returncode == 0:
            raise RuntimeError('Expected denial did not happen')
        return ''
    if result.returncode:
        raise RuntimeError('Private command failed')
    return result.stdout.decode().strip()


def admin_sql(statement, database='Monolithic'):
    return checked(['docker', 'exec', '-i', CONTAINER, 'bash', '-c',
        'export PGPASSWORD="$(cat /run/secrets/database_owner)"; '
        'exec psql -X -q -At -h 127.0.0.1 -U Monolithic -v ON_ERROR_STOP=1 -d ' + database], data=statement.encode())


def runtime_sql(statement, expect_failure=False):
    return checked(['docker', 'exec', '-i', CONTAINER, 'bash', '-c',
        'export PGPASSWORD="$(cat)"; exec psql -X -q -At -h 127.0.0.1 -U police_runtime '
        '-v ON_ERROR_STOP=1 -d Monolithic -c "' + statement + '"'],
        data=(SECRET / 'app/runtime_database_password').read_bytes(), expect_failure=expect_failure)


def run():
    global STAGE
    if os.geteuid() != 0:
        raise RuntimeError('Root required')
    os.umask(0o077)
    marker = json.loads(STATE.read_text())
    if marker.get('runtimeGrantsRestored'):
        raise RuntimeError('Runtime grants already provisioned')
    identity = json.loads(Path('/var/lib/police-management/production-identity-20261107.json').read_text())
    if identity.get('result') != 'PRODUCTION_REALM_PREPARED':
        raise RuntimeError('Identity preparation must come first')
    app = SECRET / 'app'
    if app.exists():
        missing = [name for name in ('runtime_database_password', 'oidc_client_secret',
                                     'rbac_client_secret', 'data.key') if not (app / name).is_file()]
        if missing:
            raise RuntimeError('Incomplete existing production app secrets: ' + ', '.join(missing))
    else:
        STAGE = 'write-production-app-secrets'
        app.mkdir(mode=0o700)
        password = secrets.token_hex(32)
        target = app / 'runtime_database_password'
        target.write_text(password + '\n')
        target.chmod(0o600)
        target = app / 'oidc_client_secret'
        target.write_text(secrets.token_urlsafe(32) + '\n')
        target.chmod(0o600)
        target = app / 'rbac_client_secret'
        target.write_text((SECRET / 'rbac_client_secret').read_text())
        target.chmod(0o600)
        target = app / 'data.key'
        target.write_bytes(Path('/etc/police-management/secrets/production-candidate-20261105/data.key').read_bytes())
        target.chmod(0o444)
        app.chmod(0o755)
    STAGE = 'provision-runtime-role'
    if admin_sql("SELECT count(*) FROM pg_roles WHERE rolname='police_runtime';", 'postgres') == '1':
        print('Runtime role already exists; verifying instead of re-provisioning.')
    else:
        sql = '\\set runtime_password \'' + (SECRET / 'app/runtime_database_password').read_text().strip() + '\'\n' + SQL.read_text()
        result = subprocess.run(['docker', 'exec', '-i', CONTAINER, 'bash', '-c',
            'export PGPASSWORD="$(cat /run/secrets/database_owner)"; '
            'exec psql -X -q -h 127.0.0.1 -U Monolithic -v ON_ERROR_STOP=1 -d Monolithic'],
            input=sql.encode(), capture_output=True)
        if result.returncode:
            raise RuntimeError('Runtime role provisioning failed; inspect privately, no SQL output shown')
    STAGE = 'verify-restricted-runtime'
    if admin_sql("SELECT rolsuper FROM pg_roles WHERE rolname='police_runtime';") != 'f':
        raise RuntimeError('Runtime role is not restricted')
    if runtime_sql('SELECT count(*) FROM public.household;') != '1291':
        raise RuntimeError('Runtime role cannot read business data')
    if runtime_sql('SELECT count(*) FROM public.rbac_profile;') != '4':
        raise RuntimeError('Runtime role cannot read RBAC profiles')
    runtime_sql('SELECT count(*) FROM public.databasechangelog;', expect_failure=True)
    STAGE = 'update-marker'
    marker['runtimeGrantsRestored'] = True
    STATE.write_text(json.dumps(marker))
    STATE.chmod(0o600)
    print(json.dumps({'result': 'PRODUCTION_RUNTIME_PROVISIONED', 'restrictedRole': 'police_runtime',
                      'householdReads': 1291, 'migrationTableDenied': True}))


if __name__ == '__main__':
    try:
        run()
    except Exception as error:
        print('FAIL at ' + STAGE + ': ' + type(error).__name__ + '; private output suppressed.', file=sys.stderr)
        sys.exit(1)
