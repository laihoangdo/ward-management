#!/usr/bin/env python3
"""Deploy the production application against the isolated candidate database.

Creates the production compose project, attaches the candidate database to its internal
network, starts the app on a loopback-only port and waits for health. Never publishes
the database and never touches the public route."""
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import urllib.request

COMPOSE = Path('/opt/police-management/production/app.compose.yml')
IMAGE = 'police-app-production:20261107-1'
DB_CONTAINER = 'police-production-candidate-db-20261105'
STATE = Path('/var/lib/police-management/production-app-20261107.json')
STAGE = 'preflight'

COMPOSE_YML = '''name: police-production

x-logging: &bounded-logging
  driver: local
  options:
    max-size: '10m'
    max-file: '5'

services:
  app:
    image: police-app-production:20261107-1
    restart: unless-stopped
    environment:
      SPRING_PROFILES_ACTIVE: prod,vps,vps-prod
      SPRING_OUTPUT_ANSI_ENABLED: NEVER
      LOGGING_LEVEL_ROOT: WARN
      LOGGING_LEVEL_COM_POLICEMANAGEMENT_COM: WARN
    volumes:
      - /etc/police-management/secrets/production/app:/run/secrets/app:ro
    ports:
      - '127.0.0.1:18082:8080'
    extra_hosts:
      - 'sunnytech.cloud:172.29.41.1'
    networks:
      database: {}
      proxy:
        ipv4_address: 172.29.41.10
    read_only: true
    tmpfs:
      - /tmp:rw,nosuid,size=256m,uid=1000,gid=1000,mode=1777
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    mem_limit: 1536m
    logging: *bounded-logging
    healthcheck:
      test:
        [
          'CMD-SHELL',
          "bash -c 'exec 3<>/dev/tcp/127.0.0.1/8080; printf \\"GET /management/health HTTP/1.0\\\\r\\\\nHost: localhost\\\\r\\\\n\\\\r\\\\n\\" >&3; grep -q UP <&3'",
        ]
      interval: 15s
      timeout: 5s
      retries: 20
      start_period: 90s

networks:
  database:
    internal: true
  proxy:
    ipam:
      config:
        - subnet: 172.29.41.0/24
          gateway: 172.29.41.1
'''


def checked(args, data=None):
    result = subprocess.run(args, input=data, capture_output=True)
    if result.returncode:
        raise RuntimeError('Private command failed: ' + args[0])
    return result.stdout.decode().strip()


def run():
    global STAGE
    if os.geteuid() != 0:
        raise RuntimeError('Root required')
    os.umask(0o077)
    marker = json.loads(Path('/var/lib/police-management/production-candidate-20261105.json').read_text())
    if not marker.get('runtimeGrantsRestored'):
        raise RuntimeError('Runtime grants must be provisioned first')
    if json.loads(Path('/var/lib/police-management/production-identity-20261107.json').read_text()).get('result') != 'PRODUCTION_REALM_PREPARED':
        raise RuntimeError('Production realm must be prepared first')
    checked(['docker', 'image', 'inspect', IMAGE])
    STAGE = 'write-production-compose'
    directory = COMPOSE.parent
    if directory.exists():
        if not COMPOSE.is_file() or COMPOSE.read_text() != COMPOSE_YML:
            raise RuntimeError('Production deployment directory already exists with different content')
    else:
        directory.mkdir(mode=0o700, parents=True)
        COMPOSE.write_text(COMPOSE_YML)
        COMPOSE.chmod(0o600)
    STAGE = 'create-app-container'
    checked(['docker', 'compose', '-f', str(COMPOSE), 'create', 'app'])
    STAGE = 'attach-candidate-database'
    networks = json.loads(checked(['docker', 'inspect', DB_CONTAINER, '--format', '{{json .NetworkSettings.Networks}}']))
    if 'police-production_database' not in networks:
        checked(['docker', 'network', 'connect', 'police-production_database', DB_CONTAINER])
    STAGE = 'start-production-app'
    checked(['docker', 'compose', '-f', str(COMPOSE), 'up', '-d', 'app'])
    deadline = time.time() + 300
    while time.time() < deadline:
        try:
            with urllib.request.urlopen('http://127.0.0.1:18082/management/health', timeout=5) as response:
                if response.status == 200 and json.loads(response.read()).get('status') == 'UP':
                    break
        except Exception:
            pass
        time.sleep(5)
    else:
        raise RuntimeError('Production app did not become healthy')
    STAGE = 'write-marker'
    state = {'result': 'PRODUCTION_APP_DEPLOYED', 'image': IMAGE, 'port': 18082,
             'database': DB_CONTAINER, 'publicGoLive': False}
    STATE.write_text(json.dumps(state))
    STATE.chmod(0o600)
    print(json.dumps(state))


if __name__ == '__main__':
    try:
        run()
    except Exception as error:
        print('FAIL at ' + STAGE + ': ' + type(error).__name__ + '; private output suppressed.', file=sys.stderr)
        sys.exit(1)
