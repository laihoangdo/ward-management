#!/usr/bin/env python3
"""One-time synthetic application secrets. Never rotate existing credentials implicitly."""
import base64
import os
import secrets
from pathlib import Path

if os.geteuid() != 0:
    raise SystemExit('Run via sudo')
root = Path('/etc/police-management/secrets/staging')
app = root / 'app'
if app.exists() or (root / 'migration.properties').exists():
    raise SystemExit('Application secrets already exist; explicit review required')
app.mkdir(mode=0o555)

def write(file, text):
    with file.open('x') as stream:
        stream.write(text)
    file.chmod(0o444)

write(app / 'runtime_database_password', secrets.token_hex(32))
write(app / 'oidc_client_secret', (root / 'web_client').read_text())
write(app / 'rbac_client_secret', (root / 'rbac_client').read_text())
write(app / 'data.key', base64.b64encode(secrets.token_bytes(32)).decode())
write(root / 'migration.properties', '\n'.join([
    'url=jdbc:postgresql://database:5432/Monolithic', 'username=Monolithic',
    'password=' + (root / 'database_owner').read_text(),
    'changeLogFile=config/liquibase/master.xml', 'contexts=!test and !faker', 'defaultSchemaName=public', ''
]))
backup_key = root.parent / 'local_backup_passphrase'
if not backup_key.exists():
    if list(Path('/var/backups/police-management').glob('staging-*.gpg')):
        raise SystemExit('Existing encrypted backups without key: refuse replacement key')
    write(backup_key, secrets.token_urlsafe(64))
    backup_key.chmod(0o600)
print('Created synthetic app/migration secrets and local backup key; no values printed.')
