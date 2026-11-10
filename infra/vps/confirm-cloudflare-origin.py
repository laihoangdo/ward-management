#!/usr/bin/env python3
"""Operator acknowledgement AFTER independent edge + fresh SSH + backend checks succeed."""
import datetime
import json
import os
from pathlib import Path
import subprocess
import sys

if os.geteuid()!=0 or sys.argv[1:]!=['--external-verified']:
    raise SystemExit('Run via sudo with --external-verified only after independent checks')
path=Path('/etc/police-management/cloudflare-origin.json')
data=json.loads(path.read_text())
if data.get('confirmed') is not False or not data.get('ranges'):
    raise SystemExit('Unexpected origin policy state')
subprocess.run(['systemctl','stop','police-cloudflare-origin-rollback.timer'],check=True)
data['confirmed']=True
data['confirmedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
temporary=path.with_suffix('.confirmed.partial')
with temporary.open('x') as stream:
    json.dump(data,stream)
temporary.chmod(0o600)
temporary.replace(path)
print('PASS: timed rollback cancelled after verified Cloudflare/fresh-SSH/backend gates.')
