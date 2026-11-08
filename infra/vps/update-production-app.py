#!/usr/bin/env python3
"""Roll the production application to a new immutable image tag.

Requires a fresh successful offsite production backup, rewrites the pinned image
in the production compose, recreates the app container and waits for health.
The previous image stays on the host for rollback; pass its tag to roll back."""
import datetime as dt
import json
import os
import re
from pathlib import Path
import subprocess
import sys
import time
import urllib.request

COMPOSE = Path('/opt/police-management/production/app.compose.yml')
MARKER = Path('/var/lib/police-management/production-app-20261107.json')
UPLOAD_MARKER = Path('/var/lib/police-management/last-production-gcs-upload.json')
TAG_PATTERN = re.compile(r'^police-app-production:[0-9]{8}-[0-9]+$')
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
    if len(sys.argv) != 2 or not TAG_PATTERN.fullmatch(sys.argv[1]):
        raise RuntimeError('Expected exactly one image tag like police-app-production:YYYYMMDD-N')
    image = sys.argv[1]
    if json.loads(MARKER.read_text()).get('result') != 'PRODUCTION_APP_DEPLOYED':
        raise RuntimeError('Production app marker missing')
    STAGE = 'backup-freshness-gate'
    upload = json.loads(UPLOAD_MARKER.read_text())
    if upload.get('result') != 'SUCCESS':
        raise RuntimeError('Last production backup upload did not succeed')
    age = (dt.datetime.now(dt.timezone.utc)
           - dt.datetime.fromisoformat(upload['uploadedAt'])).total_seconds()
    if age > 6 * 3600:
        raise RuntimeError('Offsite production backup is older than 6 hours; back up first')
    STAGE = 'image-present'
    checked(['docker', 'image', 'inspect', image])
    STAGE = 'update-compose'
    text = COMPOSE.read_text()
    pattern = re.compile(r'    image: police-app-production:[0-9]{8}-[0-9]+\n')
    if len(pattern.findall(text)) != 1:
        raise RuntimeError('Expected exactly one pinned production image line')
    COMPOSE.write_text(pattern.sub('    image: ' + image + '\n', text))
    COMPOSE.chmod(0o600)
    STAGE = 'recreate-app'
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
        raise RuntimeError('Rolled-out app did not become healthy; inspect before further action')
    STAGE = 'update-marker'
    state = json.loads(MARKER.read_text())
    state['image'] = image
    state['updatedAt'] = dt.datetime.now(dt.timezone.utc).isoformat()
    MARKER.write_text(json.dumps(state))
    MARKER.chmod(0o600)
    print(json.dumps({'result': 'PRODUCTION_APP_UPDATED', 'image': image,
                      'previousImageKeptForRollback': True}))


if __name__ == '__main__':
    try:
        run()
    except Exception as error:
        print('FAIL at ' + STAGE + ': ' + type(error).__name__ + '; private output suppressed.', file=sys.stderr)
        sys.exit(1)
