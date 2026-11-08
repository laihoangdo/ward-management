#!/usr/bin/env python3
"""Restore operational source into a new isolated candidate; never touch staging or publish ports."""
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import sys
import tarfile
import tempfile
import time

CONTAINER = 'police-production-candidate-db-20261105'
VOLUME = 'police-production-candidate-db-20261105'
SECRET = Path('/etc/police-management/secrets/production-candidate-20261105')
IMAGE = 'postgis/postgis@sha256:60f6ad1d21ea86a67d47780b9a0d1e1d200500f62b19293fa834d0dea80b8677'
STAGE = 'preflight'


def checked(args, data=None, stdin=None):
    result = subprocess.run(args, input=data, stdin=stdin, capture_output=True)
    if result.returncode:
        raise RuntimeError('Private command failed')
    return result.stdout.decode().strip()


def run():
    global STAGE
    if os.geteuid() != 0:
        raise RuntimeError('Root required')
    os.umask(0o077)
    if checked(['readlink', '-f', '/etc/nginx/sites-enabled/police-bootstrap.conf']) != '/etc/nginx/sites-available/police-identity-staging.conf':
        raise RuntimeError('Maintenance must be active')
    for kind in ('container', 'volume'):
        if subprocess.run(['docker', kind, 'inspect', CONTAINER], capture_output=True).returncode == 0:
            raise RuntimeError('Candidate already exists; inspect instead of overwriting')
    if SECRET.exists():
        raise RuntimeError('Candidate secrets already exist')
    source = Path('/var/backups/police-management/migration-source/source-20261105T180724Z.tar.gz.gpg')
    expected = Path(str(source) + '.sha256').read_text().split()[0]
    with source.open('rb') as stream:
        if hashlib.file_digest(stream, 'sha256').hexdigest() != expected:
            raise RuntimeError('Checksum mismatch')
    receipt = Path('/var/lib/police-management/migration-source') / (source.name + '.receipt.json')
    if json.loads(receipt.read_text()).get('result') != 'SUCCESS':
        raise RuntimeError('Offsite upload receipt required')
    with tempfile.TemporaryDirectory(prefix='production-import-', dir='/var/backups/police-management') as directory:
        work = Path(directory)
        STAGE = 'authenticate-source-archive'
        with (work / 'source.tar.gz').open('xb') as target:
            result = subprocess.run(['gpg', '--batch', '--pinentry-mode', 'loopback', '--passphrase-file',
                '/etc/police-management/secrets/local_backup_passphrase', '--decrypt', str(source)], stdout=target, stderr=subprocess.PIPE)
        if result.returncode:
            raise RuntimeError('Archive authentication failed')
        found = set()
        with tarfile.open(work / 'source.tar.gz') as archive:
            for member in archive:
                if member.name not in ('database.dump', 'metadata.json', 'data.key'):
                    raise RuntimeError('Unexpected archive member')
                if member.name in found or not member.isfile() or member.size > 10 * 1024**3:
                    raise RuntimeError('Invalid archive member')
                found.add(member.name)
                with archive.extractfile(member) as incoming, (work / member.name).open('xb') as output:
                    shutil.copyfileobj(incoming, output)
        if found != {'database.dump', 'metadata.json', 'data.key'}:
            raise RuntimeError('Incomplete source backup')
        manifest = json.loads((work / 'metadata.json').read_text())
        if manifest.get('scope') != 'operational-source-preflight' or len(manifest.get('tables', [])) != 51:
            raise RuntimeError('Unexpected source manifest')
        STAGE = 'create-isolated-candidate'
        SECRET.mkdir(mode=0o700)
        with (SECRET / 'database_owner').open('x') as stream:
            stream.write(secrets.token_hex(32))
        (SECRET / 'database_owner').chmod(0o444)
        shutil.copyfile(work / 'data.key', SECRET / 'data.key')
        (SECRET / 'data.key').chmod(0o444)
        checked(['docker', 'volume', 'create', VOLUME])
        checked(['docker', 'create', '--name', CONTAINER, '--network', 'none', '--memory', '1536m',
            '--security-opt', 'no-new-privileges', '--restart', 'unless-stopped',
            '-e', 'POSTGRES_USER=Monolithic', '-e', 'POSTGRES_DB=postgres',
            '-e', 'POSTGRES_PASSWORD_FILE=/run/secrets/database_owner',
            '--mount', 'type=volume,source=' + VOLUME + ',target=/var/lib/postgresql',
            '--mount', 'type=bind,source=' + str(SECRET / 'database_owner') + ',target=/run/secrets/database_owner,readonly', IMAGE])
        checked(['docker', 'start', CONTAINER])
        for _ in range(90):
            if subprocess.run(['docker', 'exec', CONTAINER, 'pg_isready', '-h', '127.0.0.1', '-U', 'Monolithic'], capture_output=True).returncode == 0:
                break
            time.sleep(2)
        else:
            raise RuntimeError('Candidate did not initialize')

        def sql(db, statement):
            return checked(['docker', 'exec', '-i', CONTAINER, 'bash', '-ec',
                'export PGPASSWORD="$(cat /run/secrets/database_owner)"; exec psql -X -q -At -h 127.0.0.1 -U Monolithic -v ON_ERROR_STOP=1 -d "$1"', '--', db], data=statement.encode())

        STAGE = 'restore-source-database'
        sql('postgres', 'CREATE DATABASE "Monolithic" TEMPLATE template0;')
        with (work / 'database.dump').open('rb') as stream:
            checked(['docker', 'exec', '-i', CONTAINER, 'bash', '-ec',
                'export PGPASSWORD="$(cat /run/secrets/database_owner)"; exec pg_restore -h 127.0.0.1 -U Monolithic --no-owner --no-privileges --exit-on-error -d Monolithic'], stdin=stream)
        STAGE = 'reconcile-source-fingerprints'
        actual_tables = json.loads(sql('Monolithic', "SELECT json_agg(schemaname||'.'||tablename ORDER BY schemaname,tablename) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema');"))
        if actual_tables != [table['table'] for table in manifest['tables']]:
            raise RuntimeError('Restored table set differs')
        for table in manifest['tables']:
            if not re.fullmatch('[a-z0-9_]+\\.[a-z0-9_]+', table['table']):
                raise RuntimeError('Invalid table identifier')
            statement = "SELECT json_build_object('count',count(*),'fingerprint',coalesce(md5(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text))),'EMPTY')) FROM " + table['table'] + ' t;'
            actual = json.loads(sql('Monolithic', statement))
            if actual['count'] != table['count'] or actual['fingerprint'] != table['fingerprint']:
                raise RuntimeError('Restored content differs')
        print('PASS: operational-source database restored into isolated candidate; all 51 table counts/fingerprints match.')
        print('Candidate is NOT public, has no network or published ports, and has not run application migrations. Source/staging untouched.')
        marker = Path('/var/lib/police-management/production-candidate-20261105.json')
        marker.write_text(json.dumps({'result': 'RESTORE_RECONCILED', 'sourceSha256': expected,
            'container': CONTAINER, 'volume': VOLUME, 'matchedTables': 51, 'publicGoLive': False,
            'runtimeGrantsRestored': False, 'keycloakImported': False}))
        marker.chmod(0o600)


if __name__ == '__main__':
    try:
        run()
    except Exception as error:
        print('FAIL at ' + STAGE + ': ' + type(error).__name__ + '; candidate preserved for review, private output suppressed.', file=sys.stderr)
        sys.exit(1)
