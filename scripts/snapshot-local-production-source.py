#!/usr/bin/env python3
"""Read-only Windows source snapshot, encrypted locally with the existing escrowed recovery key.

No upload, runtime switch, schema migration or Keycloak mutation. No plaintext diagnostic output.
"""
import ctypes
from ctypes import wintypes
import datetime as dt
import hashlib
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parent.parent
CONTAINER = 'police-postgis-1'
DATABASE = 'Monolithic'
GPG = Path(r'C:\Program Files\Git\usr\bin\gpg.exe')
STAGE = 'preflight'


def checked(args, **kwargs):
    result = subprocess.run(args, capture_output=True, **kwargs)
    if result.returncode:
        text = result.stderr.decode(errors='replace').lower()
        for marker, code in [('invalid option', 'UNSUPPORTED_OPTION'), ('no agent running', 'GPG_AGENT_UNAVAILABLE'),
                             ('problem with the agent', 'GPG_AGENT_FAILURE'), ('no pinentry', 'GPG_PINENTRY_FAILURE'),
                             ('failed to start agent', 'GPG_AGENT_START_FAILED'), ('invalid value', 'INVALID_VALUE'),
                             ('permission denied', 'PERMISSION_DENIED'), ('file exists', 'OUTPUT_EXISTS')]:
            if marker in text:
                print('DIAGNOSTIC: ' + code, file=sys.stderr)
                break
        raise RuntimeError('Private command failed')
    return result.stdout


def recovery_key():
    class Blob(ctypes.Structure):
        _fields_ = [('length', wintypes.DWORD), ('data', ctypes.POINTER(ctypes.c_ubyte))]
    protected = (ROOT / '.tc2-private/vps-backup-passphrase.dpapi').read_bytes()
    entropy = b'police-vps-backup-recovery-v1'
    buffers = [ctypes.create_string_buffer(value) for value in (protected, entropy)]
    blobs = [Blob(len(value), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_ubyte)))
             for value, buffer in zip((protected, entropy), buffers)]
    output = Blob()
    unprotect = ctypes.windll.crypt32.CryptUnprotectData
    unprotect.argtypes = [ctypes.POINTER(Blob), ctypes.c_void_p, ctypes.POINTER(Blob),
                          ctypes.c_void_p, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(Blob)]
    unprotect.restype = wintypes.BOOL
    if not unprotect(ctypes.byref(blobs[0]), None, ctypes.byref(blobs[1]), None, None, 1, ctypes.byref(output)):
        raise RuntimeError('Windows protected recovery key unavailable')
    try:
        key = ctypes.string_at(output.data, output.length)
        if len(key) < 40 or b'\n' in key or b'\r' in key:
            raise RuntimeError('Unexpected recovery key format')
        return key
    finally:
        ctypes.memset(output.data, 0, output.length)
        ctypes.windll.kernel32.LocalFree.argtypes = [ctypes.c_void_p]
        ctypes.windll.kernel32.LocalFree(ctypes.cast(output.data, ctypes.c_void_p))


def run():
    global STAGE
    def msys(path):
        return '/' + path.drive[0].lower() + '/' + '/'.join(path.parts[1:])
    if sys.platform != 'win32' or not GPG.is_file():
        raise RuntimeError('Reviewed Windows/GPG environment required')
    source = json.loads(checked(['docker', 'inspect', CONTAINER]))[0]
    ports = source['NetworkSettings']['Ports'].get('5432/tcp') or []
    if not any(p['HostIp'] == '127.0.0.1' and p['HostPort'] == '5433' for p in ports):
        raise RuntimeError('Source container/port mismatch')
    STAGE = 'unprotect-existing-recovery-key'
    key = recovery_key()
    stamp = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    destination = ROOT / '.tc2-private' / ('production-source-' + stamp)
    STAGE = 'create-private-backup-directory'
    destination.mkdir(exist_ok=False)
    sid = checked(['powershell', '-NoProfile', '-Command',
                   '[Security.Principal.WindowsIdentity]::GetCurrent().User.Value']).decode().strip()
    checked(['icacls', str(destination), '/inheritance:r', '/grant:r',
             '*' + sid + ':(OI)(CI)F', '*S-1-5-18:(OI)(CI)F'])
    session = None
    with tempfile.TemporaryDirectory(prefix='private-work-', dir=destination) as temp:
        work = Path(temp)
        homedir = destination / 'g'
        homedir.mkdir()
        try:
            STAGE = 'export-read-only-snapshot'
            session = subprocess.Popen(['docker', 'exec', '-i', CONTAINER, 'psql', '-X', '-q', '-At',
                '-U', 'Monolithic', '-d', DATABASE, '-v', 'ON_ERROR_STOP=1'],
                stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)

            def sql(statement):
                session.stdin.write((statement + '\n').encode())
                session.stdin.flush()
                line = session.stdout.readline()
                if not line:
                    raise RuntimeError('Read-only snapshot session ended')
                return line.decode().strip()

            snapshot = sql('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY; SELECT pg_export_snapshot();')
            if not __import__('re').fullmatch(r'[0-9A-Fa-f]+-[0-9A-Fa-f]+-[0-9]+', snapshot):
                raise RuntimeError('Unexpected exported snapshot identifier')
            tables = json.loads(sql("SELECT json_agg(schemaname||'.'||tablename ORDER BY schemaname,tablename) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema');"))
            manifest = {'format': 1, 'scope': 'operational-source-preflight', 'sourceContainer': CONTAINER,
                        'sourceDatabase': DATABASE, 'snapshotAt': stamp, 'tables': [],
                        'identityDatabaseIncluded': False, 'finalCutoverSnapshot': False}
            STAGE = 'reference-table-fingerprints'
            for table in tables:
                schema, name = table.split('.')
                if not all(__import__('re').fullmatch('[a-z0-9_]+', part) for part in (schema, name)):
                    raise RuntimeError('Unexpected table identifier')
                qualified = '"' + schema + '"."' + name + '"'
                report = json.loads(sql("SELECT json_build_object('count',count(*),'fingerprint',coalesce(md5(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text))),'EMPTY')) FROM " + qualified + ' t;'))
                manifest['tables'].append(dict(table=table, **report))
            STAGE = 'dump-consistent-snapshot'
            dump = work / 'database.dump'
            with dump.open('xb') as output:
                result = subprocess.run(['docker', 'exec', CONTAINER, 'pg_dump', '-U', 'Monolithic',
                    '-d', DATABASE, '--format=custom', '--no-password', '--lock-wait-timeout=10s',
                    '--snapshot=' + snapshot], stdout=output, stderr=subprocess.PIPE)
            if result.returncode:
                raise RuntimeError('Read-only dump failed')
            session.stdin.write(b'ROLLBACK;\n\\q\n')
            session.stdin.close()
            if session.wait(timeout=30):
                raise RuntimeError('Snapshot session did not close cleanly')
            session = None
            STAGE = 'package-backup-and-existing-data-key'
            archive = work / 'source.tar.gz'
            with tarfile.open(archive, 'w:gz') as tar:
                tar.add(dump, arcname='database.dump')
                for name, data in [('metadata.json', json.dumps(manifest).encode()),
                                   ('data.key', (ROOT / '.tc2-private/data.key').read_bytes())]:
                    member = tarfile.TarInfo(name)
                    member.size, member.mode = len(data), 0o600
                    tar.addfile(member, io.BytesIO(data))
            encrypted = destination / ('source-' + stamp + '.tar.gz.gpg')
            # Git's bundled GPG requires its MSYS login environment to start gpg-agent.
            # The fixed shell program only forwards argv; passphrase remains stdin, never shell text.
            common = [str(GPG.parents[2] / 'bin/bash.exe'), '-lc', 'exec gpg "$@"', 'gpg',
                      '--homedir', msys(homedir), '--batch', '--no-symkey-cache',
                      '--pinentry-mode', 'loopback', '--passphrase-fd', '0']
            STAGE = 'encrypt-source-backup'
            checked(common + ['--symmetric', '--cipher-algo', 'AES256', '--output', msys(encrypted), msys(archive)], input=key + b'\n')
            STAGE = 'authenticate-encrypted-backup'
            checked(common + ['--decrypt', '--output', '/dev/null', msys(encrypted)], input=key + b'\n')
            with encrypted.open('rb') as stream:
                digest = hashlib.file_digest(stream, 'sha256').hexdigest()
            Path(str(encrypted) + '.sha256').write_text(digest + '  ' + encrypted.name + '\n')
            print('PASS: consistent read-only source snapshot encrypted and GPG-authenticated locally; ' + str(len(tables)) + ' table fingerprints included.')
            print('Backup: ' + str(encrypted.relative_to(ROOT)))
            print('No upload or DB restore performed; identity/RBAC reconciliation and final write-freeze still required.')
        finally:
            if session is not None:
                try:
                    session.stdin.write(b'ROLLBACK;\n\\q\n')
                    session.stdin.flush()
                    session.communicate(timeout=10)
                except Exception:
                    session.kill()
                    session.wait()
            key = None


if __name__ == '__main__':
    try:
        run()
    except Exception as error:
        print('FAIL at ' + STAGE + ': ' + type(error).__name__ + '; private diagnostic output suppressed.', file=sys.stderr)
        sys.exit(1)
