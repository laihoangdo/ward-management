#!/usr/bin/env python3
"""Owner-approved brief local Keycloak stop/copy/restart, offline export from a private clone."""
import datetime as dt
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parent.parent
SOURCE = 'monolithic-keycloak-1'
STAGE = 'preflight'


def run():
    global STAGE
    spec = importlib.util.spec_from_file_location('snapshot_source', Path(__file__).with_name('snapshot-local-production-source.py'))
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    checked = helper.checked
    key = helper.recovery_key()
    info = json.loads(checked(['docker', 'inspect', SOURCE]))[0]
    if not info['State']['Running']:
        raise RuntimeError('Source must initially be running')
    stamp = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    destination = ROOT / '.tc2-private' / ('identity-source-' + stamp)
    destination.mkdir(exist_ok=False)
    sid = checked(['powershell', '-NoProfile', '-Command', '[Security.Principal.WindowsIdentity]::GetCurrent().User.Value']).decode().strip()
    checked(['icacls', str(destination), '/inheritance:r', '/grant:r', '*' + sid + ':(OI)(CI)F', '*S-1-5-18:(OI)(CI)F'])
    clone = 'police-identity-export-' + uuid.uuid4().hex
    stopped = created = False

    def msys(p):
        return '/' + p.drive[0].lower() + '/' + '/'.join(p.parts[1:])

    with tempfile.TemporaryDirectory(prefix='private-', dir=destination) as directory:
        work = Path(directory)
        h2, export = work / 'h2', work / 'export'
        h2.mkdir()
        export.mkdir()
        try:
            STAGE = 'stop-and-copy-source-identity'
            checked(['docker', 'stop', '--time', '45', SOURCE])
            stopped = True
            checked(['docker', 'cp', SOURCE + ':/opt/keycloak/data/h2/.', str(h2)])
            STAGE = 'restart-source-identity'
            checked(['docker', 'start', SOURCE])
            stopped = False
            for _ in range(60):
                try:
                    with urllib.request.urlopen('http://127.0.0.1:9080/realms/jhipster/.well-known/openid-configuration', timeout=3) as response:
                        if response.status == 200:
                            break
                except Exception:
                    time.sleep(2)
            else:
                raise RuntimeError('Source identity readiness not verified')
            print('PASS: local source Keycloak restarted and OIDC discovery responds; original container preserved.', flush=True)
            STAGE = 'export-offline-private-clone'
            checked(['docker', 'create', '--name', clone, '--network', 'none', '--memory', '1536m', '--user', '0:0',
                '--entrypoint', '/opt/keycloak/bin/kc.sh',
                '--mount', 'type=bind,source=' + str(h2) + ',target=/opt/keycloak/data/h2',
                '--mount', 'type=bind,source=' + str(export) + ',target=/export',
                info['Image'], 'export', '--db=dev-file', '--realm=jhipster', '--dir=/export', '--users=realm_file'])
            created = True
            result = subprocess.run(['docker', 'start', '--attach', clone], capture_output=True, timeout=240)
            if result.returncode:
                import re
                text = (result.stdout + result.stderr).decode(errors='replace').lower()
                known = ['database may be already in use', 'out of memory', 'permission denied',
                         'unknown option', 'invalid value', 'read-only file system', 'no realm found',
                         'failed to start', 'db-kind', 'optimized', 'build time', 'cache', 'h2', 'dev-file']
                print('EXPORT_DIAGNOSTIC: ' + ', '.join(value for value in known if value in text), flush=True)
                words = set('error failed cannot could not export import realm database available find provider factory jdbc url keycloak port bind address already use connection connect authentication password unsupported storage version file directory permission denied option invalid build configuration value dev h2 dev-file production server development'.split())
                relevant = '\n'.join(line for line in text.splitlines() if 'error' in line or 'caused by' in line)
                print('SAFE_ERROR_WORDS: ' + ' '.join(w for w in re.findall(r'[a-z-]+', relevant) if w in words)[:800], flush=True)
                raise RuntimeError('Offline identity export failed')
            documents = [json.loads(file.read_text()) for file in export.glob('*.json')]
            realms = [doc for doc in documents if doc.get('realm') == 'jhipster']
            exported_ids = {user['id'] for doc in documents for user in doc.get('users', [])}
            sql = "BEGIN READ ONLY; SELECT coalesce(json_agg(subject),'[]'::json) FROM (SELECT subject FROM rbac_profile UNION SELECT subject FROM rbac_assignment UNION SELECT subject FROM rbac_record_scope) s; COMMIT;"
            subjects = set(json.loads(checked(['docker', 'exec', 'police-postgis-1', 'psql', '-X', '-q', '-At',
                '-U', 'Monolithic', '-d', 'Monolithic', '-v', 'ON_ERROR_STOP=1', '-c', sql])))
            if len(realms) != 1 or len(subjects) != 4 or not subjects.issubset(exported_ids):
                raise RuntimeError('Unexpected exported identity inventory')
            STAGE = 'encrypt-identity-export'
            archive = work / 'identity.tar.gz'
            with tarfile.open(archive, 'w:gz') as tar:
                # H2 clone is deliberately not published; archive includes the portable realm export only.
                for file in export.glob('*.json'):
                    tar.add(file, arcname='identity/' + file.name)
            home = destination / 'g'
            home.mkdir()
            output = destination / ('identity-' + stamp + '.tar.gz.gpg')
            common = [str(helper.GPG.parents[2] / 'bin/bash.exe'), '-lc', 'exec gpg "$@"', 'gpg',
                      '--homedir', msys(home), '--batch', '--no-symkey-cache', '--pinentry-mode', 'loopback', '--passphrase-fd', '0']
            checked(common + ['--symmetric', '--cipher-algo', 'AES256', '--output', msys(output), msys(archive)], input=key + b'\n')
            checked(common + ['--decrypt', '--output', '/dev/null', msys(output)], input=key + b'\n')
            with output.open('rb') as stream:
                digest = hashlib.file_digest(stream, 'sha256').hexdigest()
            Path(str(output) + '.sha256').write_text(digest + '  ' + output.name + '\n')
            print('PASS: portable jhipster realm with all four business-subject IDs (plus service identities) encrypted and GPG-authenticated locally.')
            print('Backup: ' + str(output.relative_to(ROOT)))
        finally:
            if stopped:
                checked(['docker', 'start', SOURCE])
            if created:
                checked(['docker', 'rm', '-f', '-v', clone])
            key = None


if __name__ == '__main__':
    try:
        run()
    except Exception as error:
        print('FAIL at ' + STAGE + ': ' + type(error).__name__ + '; private output suppressed.', file=sys.stderr)
        sys.exit(1)
