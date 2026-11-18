#!/usr/bin/env python3
"""Add the production realm import mount to the owned Keycloak compose and restart it.

Keycloak state lives in PostgreSQL, so recreating the container is safe. The import is
idempotent: an existing realm is skipped on every later restart."""
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import urllib.request

COMPOSE = Path('/opt/police-management/staging/compose.yml')
ANCHOR = '      - /etc/police-management/secrets/staging/realm.json:/opt/keycloak/data/import/realm.json:ro\n'
ADDITION = '      - /etc/police-management/secrets/production/realm.json:/opt/keycloak/data/import/realm-production.json:ro\n'
STATE = Path('/var/lib/police-management/production-identity-20261107.json')
STAGE = 'preflight'


def checked(args):
    result = subprocess.run(args, capture_output=True)
    if result.returncode:
        raise RuntimeError('Private command failed: ' + args[0])
    return result.stdout.decode().strip()


def run():
    global STAGE
    if os.geteuid() != 0:
        raise RuntimeError('Root required')
    os.umask(0o077)
    if json.loads(STATE.read_text()).get('result') != 'PRODUCTION_REALM_PREPARED':
        raise RuntimeError('Production realm must be prepared first')
    text = COMPOSE.read_text()
    STAGE = 'patch-compose'
    if ADDITION in text:
        if text.count(ADDITION) != 1:
            raise RuntimeError('Ambiguous compose content')
    else:
        if text.count(ANCHOR) != 1:
            raise RuntimeError('Expected staging import mount not found exactly once')
        COMPOSE.write_text(text.replace(ANCHOR, ANCHOR + ADDITION))
    STAGE = 'recreate-keycloak'
    checked(['docker', 'compose', '-f', str(COMPOSE), 'up', '-d', 'keycloak'])
    deadline = time.time() + 240
    while time.time() < deadline:
        status = checked(['docker', 'inspect', 'police-staging-keycloak-1',
                          '--format', '{{.State.Health.Status}}'])
        if status == 'healthy':
            break
        time.sleep(5)
    else:
        raise RuntimeError('Keycloak did not become healthy')
    STAGE = 'verify-realm-import'
    deadline = time.time() + 60
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(
                    'http://127.0.0.1:18080/realms/jhipster/.well-known/openid-configuration', timeout=5) as response:
                if response.status == 200:
                    issuer = json.loads(response.read())['issuer']
                    if issuer != 'https://sunnytech.cloud/realms/jhipster':
                        raise RuntimeError('Unexpected production issuer')
                    break
        except RuntimeError:
            raise
        except Exception:
            time.sleep(4)
    else:
        raise RuntimeError('Production realm was not imported')
    state = json.loads(STATE.read_text())
    state['keycloakImported'] = True
    STATE.write_text(json.dumps(state))
    STATE.chmod(0o600)
    print(json.dumps({'result': 'PRODUCTION_REALM_IMPORTED', 'issuer': 'https://sunnytech.cloud/realms/jhipster',
                      'keycloakHealthy': True}))


if __name__ == '__main__':
    try:
        run()
    except Exception as error:
        print('FAIL at ' + STAGE + ': ' + type(error).__name__ + '; private output suppressed.', file=sys.stderr)
        sys.exit(1)
