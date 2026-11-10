#!/usr/bin/env python3
"""Read-only encrypted identity inventory; prints only public configuration metadata."""
import json
import os
import subprocess
import tarfile
import sys

try:
    if os.geteuid() != 0:
        raise RuntimeError('Root required')
    process = subprocess.Popen(['gpg', '--batch', '--pinentry-mode', 'loopback', '--passphrase-file',
        '/etc/police-management/secrets/local_backup_passphrase', '--decrypt',
        '/var/backups/police-management/migration-source/identity-20261105T181353Z.tar.gz.gpg'],
        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    documents = []
    with tarfile.open(fileobj=process.stdout, mode='r|gz') as archive:
        for member in archive:
            if not member.isfile() or member.size > 100 * 1024**2:
                raise RuntimeError('Invalid identity archive member')
            documents.append(json.load(archive.extractfile(member)))
    while process.stdout.read(1024**2):
        pass
    if process.wait() != 0:
        raise RuntimeError('Identity archive authentication failed')
    realm = next(doc for doc in documents if doc.get('realm') == 'jhipster')
    clients = [{key: client.get(key) for key in ['clientId', 'enabled', 'publicClient', 'directAccessGrantsEnabled', 'serviceAccountsEnabled']}
               for client in realm.get('clients', []) if client.get('clientId') in ['web_app', 'rbac-admin']]
    users = [user for doc in documents for user in doc.get('users', [])]
    print(json.dumps({'realm': realm['realm'], 'enabled': realm.get('enabled'), 'applicationClients': clients,
        'exportedIdentityCount': len(users), 'humanIdentities': sum(not u.get('serviceAccountClientId') for u in users),
        'otpEnrolledHumanCount': sum(not u.get('serviceAccountClientId') and any(c.get('type') == 'otp' for c in u.get('credentials', [])) for u in users),
        'enabledKnownSampleAccounts': sum(u.get('username') in ['admin', 'user'] and u.get('enabled', False) for u in users),
        'namedOwnerPresent': any(u.get('username') == 'laihoangdo' for u in users)}))
except Exception:
    print('FAIL: identity inventory; private output suppressed.', file=sys.stderr)
    sys.exit(1)
