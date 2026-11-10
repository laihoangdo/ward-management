#!/usr/bin/env python3
"""Restore encrypted staging dumps into new isolated DBs; never switch a runtime target."""
import hashlib
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import uuid

COMPOSE = ['docker', 'compose', '-f', '/opt/police-management/staging/compose.yml', 'exec', '-T', 'database', 'bash', '-ec']
AUTH = 'export PGPASSWORD="$(cat /run/secrets/database_owner)"; '

def checked(cmd, data=None, stdin=None):
    result = subprocess.run(cmd, input=data, stdin=stdin, capture_output=True)
    if result.returncode:
        raise RuntimeError('Database/archive operation failed; private output suppressed')
    return result.stdout.decode().strip()

def sql(database, statement):
    return checked(COMPOSE + [AUTH + 'exec psql -X -At -U Monolithic -v ON_ERROR_STOP=1 -d "$1"', '--', database], statement.encode())

def run(backup):
    if os.geteuid() != 0:
        raise RuntimeError('Run via sudo')
    source = Path(backup).resolve()
    if source.parent != Path('/var/backups/police-management') or not re.fullmatch(r'staging-\d{8}T\d{6}Z\.tar\.gz\.gpg', source.name):
        raise RuntimeError('Only an explicit owned staging backup is allowed')
    digest = hashlib.sha256()
    with source.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    expected = Path(str(source) + '.sha256').read_text().split()[0]
    if digest.hexdigest() != expected:
        raise RuntimeError('Backup checksum mismatch')
    suffix = uuid.uuid4().hex[:12]
    created = []
    with tempfile.TemporaryDirectory(prefix='police-staging-drill-', dir='/var/backups/police-management') as directory:
        work = Path(directory)
        allowed = {'database.dump': 'database.dump', 'keycloak.dump': 'keycloak.dump',
                   'secrets/staging/app/data.key': 'data.key'}
        gpg = subprocess.Popen(['gpg', '--batch', '--pinentry-mode', 'loopback', '--passphrase-file',
            '/etc/police-management/secrets/local_backup_passphrase', '--decrypt', str(source)], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        try:
            with tarfile.open(fileobj=gpg.stdout, mode='r|gz') as archive:
                for member in archive:
                    name = member.name.removeprefix('./')
                    if name in allowed:
                        if not member.isfile() or member.size > 10 * 1024**3:
                            raise RuntimeError('Invalid restore member')
                        with archive.extractfile(member) as incoming, (work / allowed[name]).open('xb') as target:
                            shutil.copyfileobj(incoming, target)
            while gpg.stdout.read(1024 * 1024):
                pass
            gpg.stderr.read()
            if gpg.wait() != 0:
                raise RuntimeError('Backup authentication/decryption failed')
        finally:
            if gpg.poll() is None:
                gpg.kill()
                gpg.wait()
        if any(not (work / name).is_file() for name in ['database.dump', 'keycloak.dump', 'data.key']):
            raise RuntimeError('Backup incomplete')
        if (work / 'data.key').read_bytes() != Path('/etc/police-management/secrets/staging/app/data.key').read_bytes():
            raise RuntimeError('Restored application key does not match')
        try:
            for kind, dump in [('app', 'database.dump'), ('identity', 'keycloak.dump')]:
                database = 'tc2_restore_vps_' + kind + '_' + suffix
                sql('postgres', 'CREATE DATABASE "' + database + '" TEMPLATE template0;')
                created.append(database)
                with (work / dump).open('rb') as stream:
                    checked(COMPOSE + [AUTH + 'exec pg_restore -U Monolithic --no-owner --no-privileges --exit-on-error -d "$1"', '--', database], stdin=stream)
            app, identity = created
            tables = sql('Monolithic', "select schemaname||'.'||tablename from pg_tables where schemaname in ('public','tc2_roster','database_repair','legacy_mock_20261027') and tablename not in ('databasechangelog','databasechangeloglock','spatial_ref_sys') order by 1;").splitlines()
            target_tables = sql(app, "select schemaname||'.'||tablename from pg_tables where schemaname in ('public','tc2_roster','database_repair','legacy_mock_20261027') and tablename not in ('databasechangelog','databasechangeloglock','spatial_ref_sys') order by 1;").splitlines()
            if tables != target_tables or not tables:
                raise RuntimeError('Restored application table set differs')
            for table in tables:
                if not re.fullmatch(r'[a-z0-9_]+\.[a-z0-9_]+', table):
                    raise RuntimeError('Unexpected table identifier')
                row = "(to_jsonb(t)-array['location_geom','footprint_geom','line_geom','boundary_geom'])::text"
                statement = "begin read only; set local timezone='UTC'; select count(*),coalesce(md5(string_agg(md5(" + row + "),'' order by md5(" + row + "))),'EMPTY') from " + table + " t; commit;"
                if sql('Monolithic', statement) != sql(app, statement):
                    raise RuntimeError('Restored application content differs')
            if sql(identity, "select count(*) from realm where name='police-staging';") != '1':
                raise RuntimeError('Identity realm missing after restore')
            if sql(identity, "select count(*) from user_entity where username='synthetic-mfa-gate' and enabled=false;") != '1':
                raise RuntimeError('Disabled identity state missing after restore')
            print('PASS: encrypted backup authenticated, both DBs restored, application key matched, ' + str(len(tables)) + ' application/archive tables matched; realm/disabled-identity checks passed.')
        finally:
            for database in reversed(created):
                # Names are generated here, not accepted from callers. Never drop a runtime DB.
                sql('postgres', 'DROP DATABASE "' + database + '";')

if __name__ == '__main__':
    try:
        if len(sys.argv) != 2:
            raise RuntimeError('Pass one explicit backup filename')
        run(sys.argv[1])
    except Exception as error:
        print('RESTORE_DRILL_FAILED: ' + type(error).__name__)
        raise SystemExit(1)
