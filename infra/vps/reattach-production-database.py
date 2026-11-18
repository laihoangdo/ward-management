#!/usr/bin/env python3
"""Recreate the production candidate database container attached to the production network.

The named volume holds all data; the container itself is stateless. Recreation is required
because a container created with --network none cannot be connected to other networks."""
import json
import os
from pathlib import Path
import subprocess
import sys
import time

CONTAINER = 'police-production-candidate-db-20261105'
VOLUME = 'police-production-candidate-db-20261105'
NETWORK = 'police-production_database'
SECRET = '/etc/police-management/secrets/production-candidate-20261105/database_owner'
IMAGE = 'postgis/postgis@sha256:60f6ad1d21ea86a67d47780b9a0d1e1d200500f62b19293fa834d0dea80b8677'
STATE = Path('/var/lib/police-management/production-candidate-20261105.json')
STAGE = 'preflight'


def checked(args):
    result = subprocess.run(args, capture_output=True)
    if result.returncode:
        raise RuntimeError('Private command failed: ' + args[0])
    return result.stdout.decode().strip()


def sql(statement):
    return checked(['docker', 'exec', '-i', CONTAINER, 'bash', '-c',
        'export PGPASSWORD="$(cat /run/secrets/database_owner)"; '
        'exec psql -X -q -At -h 127.0.0.1 -U Monolithic -v ON_ERROR_STOP=1 -d Monolithic -c "' + statement + '"'])


def run():
    global STAGE
    if os.geteuid() != 0:
        raise RuntimeError('Root required')
    os.umask(0o077)
    marker = json.loads(STATE.read_text())
    if marker.get('result') != 'RESTORE_RECONCILED':
        raise RuntimeError('Candidate marker missing')
    STAGE = 'stop-and-remove-container'
    subprocess.run(['docker', 'stop', CONTAINER], capture_output=True)
    checked(['docker', 'rm', CONTAINER])
    STAGE = 'recreate-on-production-network'
    checked(['docker', 'run', '-d', '--name', CONTAINER, '--network', NETWORK,
        '--memory', '1536m', '--security-opt', 'no-new-privileges', '--restart', 'unless-stopped',
        '-e', 'POSTGRES_USER=Monolithic', '-e', 'POSTGRES_DB=postgres',
        '-e', 'POSTGRES_PASSWORD_FILE=/run/secrets/database_owner',
        '--mount', 'type=volume,source=' + VOLUME + ',target=/var/lib/postgresql',
        '--mount', 'type=bind,source=' + SECRET + ',target=/run/secrets/database_owner,readonly', IMAGE])
    STAGE = 'wait-for-readiness'
    deadline = time.time() + 120
    while time.time() < deadline:
        if subprocess.run(['docker', 'exec', CONTAINER, 'pg_isready', '-h', '127.0.0.1', '-U', 'Monolithic'],
                          capture_output=True).returncode == 0:
            break
        time.sleep(3)
    else:
        raise RuntimeError('Candidate did not become ready')
    STAGE = 'verify-data-intact'
    if sql('SELECT count(*) FROM public.household;') != '1291':
        raise RuntimeError('Household data mismatch after recreation')
    if sql('SELECT count(*) FROM databasechangelog;') != '46':
        raise RuntimeError('Liquibase history mismatch after recreation')
    if sql("SELECT count(*) FROM pg_roles WHERE rolname='police_runtime';") != '1':
        raise RuntimeError('Runtime role missing after recreation')
    marker['networkAttached'] = NETWORK
    STATE.write_text(json.dumps(marker))
    STATE.chmod(0o600)
    print(json.dumps({'result': 'CANDIDATE_REATTACHED', 'network': NETWORK,
                      'households': 1291, 'changesets': 46, 'runtimeRole': True}))


if __name__ == '__main__':
    try:
        run()
    except Exception as error:
        print('FAIL at ' + STAGE + ': ' + type(error).__name__ + '; private output suppressed.', file=sys.stderr)
        sys.exit(1)
