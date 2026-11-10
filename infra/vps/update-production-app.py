#!/usr/bin/env python3
"""Roll the production application to a new immutable image tag.

Release:  update-production-app.py police-app-production:YYYYMMDD-N <sha256 of the audited release.jar>
  checks the JAR inside the image against the audited hash, requires a clean HIGH/CRITICAL Trivy scan,
  runs migrate-production-db.sh (fresh offsite backup + restore drill + Liquibase), swaps the pinned
  image, waits for health, runs verify-production-live.py, and returns to the previous image if the
  new one does not become healthy or fails verification.
Rollback: update-production-app.py police-app-production:YYYYMMDD-N --rollback
  swaps back to an image already on the host. Needs a successful offsite backup from the last
  6 hours; never runs migrations. Changesets already applied stay applied: only roll back to an
  image whose code works with the current schema."""
import datetime as dt
import hashlib
import io
import json
import os
import re
from pathlib import Path
import subprocess
import sys
import tarfile
import time
import urllib.request

ROOT = Path('/opt/police-management/production')
COMPOSE = ROOT / 'app.compose.yml'
MIGRATE = ROOT / 'migrate-production-db.sh'
VERIFY = ROOT / 'verify-production-live.py'
SCANNER = Path('/opt/police-management/security/trivy')
SCANS = Path('/var/lib/police-management/scans')
MARKER = Path('/var/lib/police-management/production-app-20261107.json')
UPLOAD_MARKER = Path('/var/lib/police-management/last-production-gcs-upload.json')
TAG_PATTERN = re.compile(r'^police-app-production:[0-9]{8}-[0-9]+$')
IMAGE_LINE = re.compile(r'    image: (police-app-production:[0-9]{8}-[0-9]+)\n')
STAGE = 'preflight'


def checked(args):
    result = subprocess.run(args, capture_output=True)
    if result.returncode:
        raise RuntimeError('Private command failed: ' + args[0])
    return result.stdout.decode().strip()


def healthy(timeout=300):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen('http://127.0.0.1:18082/management/health', timeout=5) as response:
                if response.status == 200 and json.loads(response.read()).get('status') == 'UP':
                    return True
        except Exception:
            pass
        time.sleep(5)
    return False


def pin(image):
    text = COMPOSE.read_text()
    if len(IMAGE_LINE.findall(text)) != 1:
        raise RuntimeError('Expected exactly one pinned production image line')
    COMPOSE.write_text(IMAGE_LINE.sub('    image: ' + image + '\n', text))
    COMPOSE.chmod(0o600)
    checked(['docker', 'compose', '-f', str(COMPOSE), 'up', '-d', 'app'])


def require_recent_backup():
    upload = json.loads(UPLOAD_MARKER.read_text())
    if upload.get('result') != 'SUCCESS':
        raise RuntimeError('Last production backup upload did not succeed')
    age = (dt.datetime.now(dt.timezone.utc) - dt.datetime.fromisoformat(upload['uploadedAt'])).total_seconds()
    if age > 6 * 3600:
        raise RuntimeError('Offsite production backup is older than 6 hours; back up first')


def jar_sha256(image):
    # Hash the exact bytes shipped in the image, not a file that could differ on the host.
    container = checked(['docker', 'create', image])
    try:
        archive = subprocess.run(['docker', 'cp', container + ':/app/release.jar', '-'], capture_output=True, check=True).stdout
    finally:
        subprocess.run(['docker', 'rm', container], capture_output=True)
    # `docker cp ... -` streams a tar archive holding the single file.
    with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
        member = tar.extractfile('release.jar')
        if member is None:
            raise RuntimeError('release.jar missing from image')
        return hashlib.sha256(member.read()).hexdigest()


def run():
    global STAGE
    if os.geteuid() != 0:
        raise RuntimeError('Root required')
    os.umask(0o077)
    args = sys.argv[1:]
    if len(args) != 2 or not TAG_PATTERN.fullmatch(args[0]):
        raise RuntimeError('Usage: <police-app-production:YYYYMMDD-N> <sha256>|--rollback')
    image, mode = args
    rollback = mode == '--rollback'
    if not rollback and not re.fullmatch(r'[A-Fa-f0-9]{64}', mode):
        raise RuntimeError('Expected the audited release.jar SHA256 or --rollback')
    state = json.loads(MARKER.read_text())
    if state.get('result') != 'PRODUCTION_APP_DEPLOYED':
        raise RuntimeError('Production app marker missing')
    previous = IMAGE_LINE.findall(COMPOSE.read_text())
    if len(previous) != 1:
        raise RuntimeError('Expected exactly one pinned production image line')
    previous = previous[0]
    if previous == image:
        raise RuntimeError('Image is already deployed')
    STAGE = 'image-present'
    checked(['docker', 'image', 'inspect', image])

    if rollback:
        STAGE = 'backup-freshness-gate'
        require_recent_backup()
    else:
        STAGE = 'artifact-checksum'
        if jar_sha256(image) != mode.lower():
            raise RuntimeError('release.jar in the image does not match the audited SHA256')
        STAGE = 'vulnerability-scan'
        if not os.access(SCANNER, os.X_OK):
            raise RuntimeError('Trivy is required; rollout blocked')
        SCANS.mkdir(mode=0o700, parents=True, exist_ok=True)
        checked([str(SCANNER), 'image', '--quiet', '--scanners', 'vuln', '--severity', 'HIGH,CRITICAL',
                 '--exit-code', '1', '--format', 'json', '--output', str(SCANS / (image.split(':')[1] + '.json')), image])
        STAGE = 'database-migration'
        checked([str(MIGRATE), image])

    STAGE = 'swap-image'
    pin(image)
    STAGE = 'health'
    verified = healthy()
    if verified:
        STAGE = 'live-verification'
        verified = subprocess.run(['python3', str(VERIFY)], capture_output=True).returncode == 0
    if not verified:
        STAGE = 'automatic-rollback'
        pin(previous)
        if not healthy():
            raise RuntimeError('New image failed and the previous image did not recover; act manually now')
        raise RuntimeError('New image failed health or live verification; previous image restored')

    STAGE = 'update-marker'
    state.update({'image': image, 'previousImage': previous, 'updatedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
                  'releaseSha256': None if rollback else mode.lower(), 'rollback': rollback})
    MARKER.write_text(json.dumps(state))
    MARKER.chmod(0o600)
    print(json.dumps({'result': 'PRODUCTION_APP_UPDATED', 'image': image, 'previousImage': previous,
                      'rollback': rollback, 'liveVerified': True}))


if __name__ == '__main__':
    try:
        run()
    except Exception as error:
        print('FAIL at ' + STAGE + ': ' + type(error).__name__ + ': ' + str(error)[:160] + '; private output suppressed.',
              file=sys.stderr)
        sys.exit(1)
