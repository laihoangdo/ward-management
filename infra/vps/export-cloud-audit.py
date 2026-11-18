#!/usr/bin/env python3
"""Mirror minimized RBAC audit metadata and operational heartbeat; never raw details/PII.

Scans both the staging database and the production candidate database. Delivered IDs are
namespaced per source so independent ID sequences can never suppress each other."""
import datetime as dt
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import sqlite3
import subprocess
import sys
import urllib.request

PROJECT = 'project-c5680fe1-4087-4ff9-829'
STATE = Path('/var/lib/police-management/cloud-audit')
KEY = Path('/etc/police-management/secrets/staging/audit-pseudonym.key')
STAGING_COMPOSE = '/opt/police-management/staging/compose.yml'
PRODUCTION_DB = 'police-production-candidate-db-20261105'


def metadata(path):
    req = urllib.request.Request('http://metadata.google.internal/computeMetadata/v1/' + path,
                                 headers={'Metadata-Flavor': 'Google'})
    with urllib.request.urlopen(req, timeout=10) as response:
        return response.read().decode()


def staging_query(statement):
    result = subprocess.run(['docker', 'compose', '-f', STAGING_COMPOSE,
        'exec', '-T', 'database', 'bash', '-ec',
        'export PGPASSWORD="$(cat /run/secrets/database_owner)"; exec psql -X -At -U Monolithic -v ON_ERROR_STOP=1 -d Monolithic'],
        input=statement.encode(), capture_output=True, timeout=45)
    if result.returncode:
        raise RuntimeError('Audit query failed')
    return result.stdout


def production_query(statement):
    result = subprocess.run(['docker', 'exec', '-i', PRODUCTION_DB, 'bash', '-c',
        'export PGPASSWORD="$(cat /run/secrets/database_owner)"; '
        'exec psql -X -At -h 127.0.0.1 -U Monolithic -v ON_ERROR_STOP=1 -d Monolithic'],
        input=statement.encode(), capture_output=True, timeout=45)
    if result.returncode:
        raise RuntimeError('Audit query failed')
    return result.stdout


def run():
    if os.geteuid() != 0:
        raise RuntimeError('Root required')
    os.umask(0o077)
    STATE.mkdir(mode=0o700, parents=True, exist_ok=True)
    if not KEY.exists():
        with KEY.open('xb') as stream:
            stream.write(os.urandom(32))
    key = KEY.read_bytes()
    if len(key) != 32 or metadata('project/project-id') != PROJECT:
        raise RuntimeError('Identity/key mismatch')
    resource = {'type': 'gce_instance', 'labels': {'project_id': PROJECT,
                'instance_id': metadata('instance/id'), 'zone': metadata('instance/zone').split('/')[-1]}}
    token = json.loads(metadata('instance/service-accounts/default/token'))['access_token']
    now = dt.datetime.now(dt.timezone.utc)

    def write(entries):
        request = urllib.request.Request('https://logging.googleapis.com/v2/entries:write',
            data=json.dumps({'entries': entries, 'partialSuccess': False}).encode(),
            headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'}, method='POST')
        with urllib.request.urlopen(request, timeout=30) as response:
            if response.status != 200:
                raise RuntimeError('Cloud write rejected')

    def entry(log, payload, severity='NOTICE', timestamp=None, insert_id=None):
        value = {'logName': 'projects/' + PROJECT + '/logs/' + log, 'resource': resource,
                 'timestamp': timestamp or now.isoformat(), 'severity': severity, 'jsonPayload': payload}
        if insert_id:
            value['insertId'] = insert_id
        return value

    exported = 0
    with sqlite3.connect(STATE / 'delivered.sqlite3') as state:
        state.execute('CREATE TABLE IF NOT EXISTS delivered_v2 '
                      '(source TEXT NOT NULL, id INTEGER NOT NULL, PRIMARY KEY(source,id))')
        if state.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='delivered'").fetchone():
            state.execute("INSERT OR IGNORE INTO delivered_v2(source,id) SELECT 'staging',id FROM delivered")
            state.execute('DROP TABLE delivered')
        # Scan indexed IDs in pages each run rather than trusting an ID high-watermark:
        # transactions can commit out of sequence. Local delivered IDs make replays safe.
        for source, query in (('staging', staging_query), ('production', production_query)):
            after = 0
            pages = 0
            while True:
                statement = ('SELECT coalesce(json_agg(t),\'[]\'::json) FROM (SELECT id,actor,action,target,occurred_at '
                             'FROM public.rbac_audit WHERE id > ' + str(after) + ' ORDER BY id LIMIT 500) t;')
                rows = json.loads(query(statement))
                if not rows:
                    break
                entries, ids = [], []
                for row in rows:
                    identifier = int(row['id'])
                    after = identifier
                    if state.execute('SELECT 1 FROM delivered_v2 WHERE source=? AND id=?', (source, identifier)).fetchone():
                        continue
                    action = row['action']
                    if not re.fullmatch(r'[a-zA-Z0-9_.:-]{1,100}', action):
                        action = 'unclassified-action'
                    digest = lambda value: hmac.new(key, str(value).encode(), hashlib.sha256).hexdigest()
                    payload = {'event': 'rbac_audit', 'database': source, 'sourceId': str(identifier), 'action': action,
                               'actorRef': digest(row['actor']), 'targetRef': digest(row['target']),
                               'sourceOccurredAt': row['occurred_at'], 'detailsOmitted': True,
                               'riskSignal': any(word in action.lower() for word in ('denied', 'failed', 'failure', 'reveal'))}
                    # Ingestion timestamp allows historical rows to enter a newly created sink.
                    # Historical staging IDs keep their original insert IDs; production IDs are namespaced.
                    insert_id = 'rbac-' + str(identifier) if source == 'staging' else 'rbac-prod-' + str(identifier)
                    entries.append(entry('police-rbac-audit', payload, insert_id=insert_id))
                    ids.append((source, identifier))
                if entries:
                    write(entries)
                    state.executemany('INSERT OR IGNORE INTO delivered_v2(source,id) VALUES (?,?)', ids)
                    state.commit()
                    exported += len(entries)
                pages += 1
                if pages >= 1000:
                    raise RuntimeError('Audit scan capacity exceeded; operator review required')

    healthy = False
    try:
        with urllib.request.urlopen('http://127.0.0.1:18082/management/health', timeout=10) as response:
            healthy = response.status == 200 and json.loads(response.read()).get('status') == 'UP'
    except Exception:
        pass
    backup_age = None
    for marker in ('/var/lib/police-management/last-production-gcs-upload.json',
                   '/var/lib/police-management/last-gcs-upload.json'):
        try:
            parsed = json.loads(Path(marker).read_text())
            if parsed.get('result') == 'SUCCESS':
                backup_age = max(0, int((now - dt.datetime.fromisoformat(parsed['uploadedAt'])).total_seconds()))
                break
        except Exception:
            continue
    disk = os.statvfs('/var/backups/police-management')
    free_bytes = disk.f_bavail * disk.f_frsize
    unhealthy = not healthy or backup_age is None or backup_age > 27 * 3600 or free_bytes < 2 * 1024**3
    payload = {'event': 'operations_heartbeat', 'appHealthy': healthy, 'unhealthy': unhealthy,
               'backupAgeSeconds': backup_age, 'diskFreeBytes': free_bytes, 'exportedAuditRows': exported}
    if sys.argv[1:] == ['--alert-test']:
        payload['alertTest'] = True
    write([entry('police-ops-health', payload, 'ERROR' if unhealthy or payload.get('alertTest') else 'NOTICE')])
    print('PASS: minimized audit metadata and operational heartbeat accepted by Cloud Logging.')


if __name__ == '__main__':
    try:
        if sys.argv[1:] not in ([], ['--alert-test']):
            raise RuntimeError('Unexpected arguments')
        run()
    except Exception:
        print('FAIL: cloud audit/heartbeat export; private output suppressed.', file=sys.stderr)
        sys.exit(1)
