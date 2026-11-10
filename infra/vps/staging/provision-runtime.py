#!/usr/bin/env python3
"""Apply the existing restricted role SQL only to the owned staging container."""
import os
import re
import subprocess
from pathlib import Path

if os.geteuid() != 0:
    raise SystemExit('Run via sudo')
password = Path('/etc/police-management/secrets/staging/app/runtime_database_password').read_text()
if not re.fullmatch('[a-f0-9]{64}', password):
    raise SystemExit('Invalid generated password format')
sql = "\\set runtime_password '" + password + "'\n" + Path('/opt/police-management/staging/database-runtime-role.sql').read_text()
cmd = ['docker', 'compose', '-f', '/opt/police-management/staging/compose.yml', 'exec', '-T', 'database', 'bash', '-ec',
    'export PGPASSWORD="$(cat /run/secrets/database_owner)"; exec psql -X -U Monolithic -d Monolithic -v ON_ERROR_STOP=1']
result = subprocess.run(cmd, input=sql, text=True, capture_output=True)
if result.returncode:
    # A psql error could echo a SQL line containing a password. Keep raw error out of deployment logs.
    raise SystemExit('Runtime role provisioning failed; inspect privately, no SQL printed')
print('Restricted police_runtime provisioned on staging; existing role was not overwritten.')
