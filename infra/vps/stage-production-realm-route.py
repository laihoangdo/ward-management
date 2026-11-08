#!/usr/bin/env python3
"""Temporarily expose the production realm routes ahead of the public cutover.

Patches the active maintenance configuration in place: the public root stays at
503 while /realms/jhipster/ is proxied, and the internal gateway gains the
production listener plus token/admin routes the application needs. The later
cutover replaces both files wholesale."""
import subprocess
import sys
from pathlib import Path

PUBLIC = Path('/etc/nginx/sites-available/police-identity-staging.conf')
INTERNAL = Path('/etc/nginx/sites-available/zz-police-staging-internal.conf')
PUBLIC_ANCHOR = '    location / {\n        default_type text/plain;'
PUBLIC_ROUTE = (
    '    location ^~ /realms/jhipster/ {\n'
    '        limit_req zone=police_staging_auth burst=30 nodelay;\n'
    '        limit_req_status 429;\n'
    '        include /etc/nginx/snippets/police-staging-identity-proxy.conf;\n'
    '    }\n'
)
INTERNAL_LISTEN = '    listen 172.29.40.1:18443 ssl;\n'
INTERNAL_LISTEN_ADD = '    listen 172.29.41.1:18443 ssl;\n'
INTERNAL_ALLOW = '    allow 172.29.40.10/32;\n'
INTERNAL_ALLOW_ADD = '    allow 172.29.41.10/32;\n    allow 172.29.41.1;\n'
INTERNAL_ANCHOR = '    location / { return 404; }\n'
INTERNAL_ROUTE = (
    '    location = /realms/jhipster/protocol/openid-connect/token {\n'
    '        include /etc/nginx/snippets/police-staging-identity-proxy.conf;\n'
    '    }\n'
    '    location ^~ /admin/realms/jhipster/ {\n'
    '        include /etc/nginx/snippets/police-staging-identity-proxy.conf;\n'
    '    }\n'
)
STAGE = 'preflight'


def curl_code(url, resolve=None):
    args = ['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}', '--max-time', '15']
    if resolve:
        args += ['--resolve', resolve, '--cacert',
                 '/etc/letsencrypt/live/sunnytech.cloud/fullchain.pem']
    result = subprocess.run(args + [url], capture_output=True)
    if result.returncode:
        return '000'
    return result.stdout.decode().strip()


def patch(path, marker, replacements):
    global STAGE
    text = path.read_text()
    if marker in text:
        print(path.name + ': production routes already present.')
        return
    for old, new in replacements:
        if text.count(old) != 1:
            raise RuntimeError('Expected anchor not found exactly once in ' + path.name)
        text = text.replace(old, new)
    STAGE = 'write-' + path.name
    path.write_text(text)


def run():
    global STAGE
    if subprocess.run(['id', '-u'], capture_output=True).returncode != 0:
        raise RuntimeError('Root required')
    STAGE = 'patch-public-conf'
    patch(PUBLIC, 'location ^~ /realms/jhipster/',
          [(PUBLIC_ANCHOR, PUBLIC_ROUTE + PUBLIC_ANCHOR)])
    STAGE = 'patch-internal-conf'
    patch(INTERNAL, '172.29.41.1:18443', [
        (INTERNAL_LISTEN, INTERNAL_LISTEN + INTERNAL_LISTEN_ADD),
        (INTERNAL_ALLOW, INTERNAL_ALLOW + INTERNAL_ALLOW_ADD),
        (INTERNAL_ANCHOR, INTERNAL_ROUTE + INTERNAL_ANCHOR),
    ])
    STAGE = 'nginx-check'
    if subprocess.run(['nginx', '-t'], capture_output=True).returncode:
        raise RuntimeError('nginx configuration test failed')
    STAGE = 'reload'
    if subprocess.run(['systemctl', 'reload', 'nginx'], capture_output=True).returncode:
        raise RuntimeError('nginx reload failed')
    STAGE = 'verify-routes'
    if curl_code('https://sunnytech.cloud/realms/jhipster/.well-known/openid-configuration') != '200':
        raise RuntimeError('Production realm route not serving discovery')
    if curl_code('https://sunnytech.cloud:18443/realms/jhipster/.well-known/openid-configuration',
                 resolve='sunnytech.cloud:18443:172.29.41.1') != '200':
        raise RuntimeError('Internal production gateway not serving discovery')
    if curl_code('https://sunnytech.cloud/realms/police-staging/.well-known/openid-configuration') != '200':
        raise RuntimeError('Staging realm route regression')
    if curl_code('https://sunnytech.cloud/') != '503':
        raise RuntimeError('Maintenance root no longer returns 503')
    print('PASS: production realm route active; public root still maintenance 503.')


if __name__ == '__main__':
    try:
        run()
    except Exception as error:
        print('FAIL at ' + STAGE + ': ' + type(error).__name__ + '; private output suppressed.', file=sys.stderr)
        sys.exit(1)
