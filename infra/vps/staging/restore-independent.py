#!/usr/bin/env python3
"""Owner-run Linux drill: GCS archive + paper key, isolated disposable PostGIS.

Does not connect to the VPS. This checks DB recovery, not full app/Keycloak login.
"""
import getpass
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import time
import uuid

IMAGE = 'postgis/postgis@sha256:60f6ad1d21ea86a67d47780b9a0d1e1d200500f62b19293fa834d0dea80b8677'
MEMBERS = {'metadata.json', 'database.dump', 'keycloak.dump', 'secrets/staging/app/data.key'}
STAGE = 'preflight'
VERSION = 'restore-tcp-ready-v3'


def stage(value):
    global STAGE
    STAGE = value
    print('STEP: ' + value, flush=True)


def checked(args, data=None, stdin=None):
    result = subprocess.run(args, input=data, stdin=stdin, capture_output=True)
    if result.returncode:
        # Never print raw stderr: pg_restore may include SQL, row values or secrets.
        error = result.stderr.decode(errors='replace').lower()
        classifications = [
            (r'role .* does not exist', 'MISSING_DATABASE_ROLE'),
            (r'extension .* is not available|could not open extension control file', 'MISSING_EXTENSION'),
            (r'unsupported version .* in file header', 'DUMP_VERSION_INCOMPATIBLE'),
            (r'no space left on device', 'RECOVERY_DISK_FULL'),
            (r'out of memory|cannot allocate memory', 'RECOVERY_MEMORY_LIMIT'),
            (r'permission denied', 'RESTORE_PERMISSION_DENIED'),
            (r'already exists', 'RESTORE_OBJECT_ALREADY_EXISTS'),
            (r'unrecognized configuration parameter', 'POSTGRES_VERSION_MISMATCH'),
            (r'connection .* failed|server closed the connection|connection refused', 'DATABASE_CONNECTION_FAILED'),
        ]
        code = next((code for pattern, code in classifications if re.search(pattern, error)), 'UNCLASSIFIED_COMMAND_FAILURE')
        print('DIAGNOSTIC: ' + code, file=sys.stderr, flush=True)
        raise RuntimeError('Command failed; private output suppressed')
    return result.stdout.decode().strip()


def extract(source, work):
    if not sys.stdin.isatty():
        raise RuntimeError('An interactive private terminal is required')
    key = getpass.getpass('Passphrase from independent paper copy: ')
    if not key:
        raise RuntimeError('Empty passphrase')
    # Passphrase travels only through stdin; plaintext is restricted to private workspace.
    stage('authenticate-archive')
    with (work / 'archive.tar.gz').open('xb') as output:
        result = subprocess.run(
            ['gpg', '--homedir', str(work / 'gnupg'), '--batch', '--no-symkey-cache',
             '--pinentry-mode', 'loopback', '--passphrase-fd', '0', '--decrypt', str(source)],
            input=(key + '\n').encode(), stdout=output, stderr=subprocess.PIPE)
    key = None
    if result.returncode:
        raise RuntimeError('Archive authentication failed')
    stage('extract-selected-members')
    found = set()
    with tarfile.open(work / 'archive.tar.gz', 'r:gz') as archive:
        for member in archive:
            name = member.name.removeprefix('./')
            if name not in MEMBERS:
                continue
            if name in found or not member.isfile() or member.size > 10 * 1024**3:
                raise RuntimeError('Invalid or duplicate restore member')
            found.add(name)
            with archive.extractfile(member) as src, (work / Path(name).name).open('xb') as dst:
                shutil.copyfileobj(src, dst)
    if found != MEMBERS:
        raise RuntimeError('Required archive members missing')
    stage('validate-archive-metadata')
    metadata = json.loads((work / 'metadata.json').read_text())
    if metadata.get('scope') != 'synthetic-staging' or metadata.get('format') != 1:
        raise RuntimeError('Only synthetic staging format 1 is accepted')
    if not (work / 'data.key').stat().st_size:
        raise RuntimeError('Application key missing')
    (work / 'archive.tar.gz').unlink()


def run(source):
    print('VERSION: ' + VERSION, flush=True)
    if sys.platform != 'linux' or Path('/opt/police-management/staging/compose.yml').exists():
        raise RuntimeError('Run on a separate Linux recovery host, not the source VPS')
    os.umask(0o077)
    source = source.resolve(strict=True)
    expected = Path(str(source) + '.sha256').read_text().split()[0]
    if not re.fullmatch('[0-9a-fA-F]{64}', expected):
        raise RuntimeError('Invalid checksum sidecar')
    with source.open('rb') as stream:
        actual = hashlib.file_digest(stream, 'sha256').hexdigest()
    if actual != expected.lower():
        raise RuntimeError('Checksum mismatch')
    stage('docker-preflight')
    checked(['docker', 'info'])
    checked(['docker', 'pull', IMAGE])
    name = 'police-independent-drill-' + uuid.uuid4().hex
    created = False
    with tempfile.TemporaryDirectory(prefix='police-independent-') as directory:
        work = Path(directory)
        (work / 'gnupg').mkdir(mode=0o700)
        extract(source, work)
        try:
            # No published ports, no network, no production volumes; trust is local to this container.
            stage('create-isolated-postgis')
            checked(['docker', 'create', '--name', name, '--network', 'none',
                     '--memory', '2g', '--security-opt', 'no-new-privileges',
                     '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', IMAGE])
            created = True
            checked(['docker', 'start', name])
            for _ in range(90):
                # The image initially starts a temporary Unix-socket-only server, then stops it.
                # Require TCP readiness so restoration cannot race that initialization shutdown.
                ready = subprocess.run(['docker', 'exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'],
                                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                if ready.returncode == 0:
                    break
                time.sleep(2)
            else:
                raise RuntimeError('Disposable PostGIS did not become ready')

            def sql(db, statement):
                return checked(['docker', 'exec', '-i', name, 'psql', '-h', '127.0.0.1', '-X', '-At',
                                '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-d', db], statement.encode())

            for db, dump in [('recovered_app', 'database.dump'), ('recovered_identity', 'keycloak.dump')]:
                stage('restore-' + db)
                sql('postgres', 'CREATE DATABASE ' + db + ' TEMPLATE template0;')
                with (work / dump).open('rb') as stream:
                    checked(['docker', 'exec', '-i', name, 'pg_restore', '-h', '127.0.0.1', '-U', 'postgres',
                             '--no-owner', '--no-privileges', '--exit-on-error', '-d', db], stdin=stream)
            stage('validate-restored-databases')
            if sql('recovered_identity', "SELECT count(*) FROM realm WHERE name IN ('master','police-staging');") != '2':
                raise RuntimeError('Required identity realms missing')
            if sql('recovered_identity', "SELECT count(*) FROM user_entity WHERE username='staging-bootstrap' AND enabled=true;") != '0':
                raise RuntimeError('Archive predates bootstrap retirement')
            if sql('recovered_identity', "SELECT count(*) FROM user_entity WHERE username LIKE 'retire-recovery-%';") != '0':
                raise RuntimeError('Temporary recovery admin remains in archive')
            count = int(sql('recovered_app', 'SELECT count(*) FROM databasechangelog;'))
            if count == 0 or sql('recovered_app', 'SELECT count(*) FROM databasechangeloglock WHERE locked=true;') != '0':
                raise RuntimeError('Liquibase history missing or lock active')
            print('PASS: checksum, authenticated decryption, two isolated DB restores, Liquibase history, realms and retired-admin checks.')
            print('Application key recovered. Full application decryption/login, roles and reference fingerprints still require acceptance.')
        finally:
            if created:
                checked(['docker', 'rm', '-f', '-v', name])
    print('PASS: disposable DB container/volumes and private plaintext workspace removed.')


if __name__ == '__main__':
    try:
        if len(sys.argv) != 2:
            raise RuntimeError('Pass the local encrypted archive path')
        run(Path(sys.argv[1]))
    except (Exception, KeyboardInterrupt):
        print('FAIL at stage: ' + STAGE + '; private diagnostic output suppressed.', file=sys.stderr)
        sys.exit(1)
