#!/usr/bin/env python3
"""Synthetic protocol test against real VPS Keycloak. Never print credentials/tokens/OTP seeds."""
import base64
import hashlib
import hmac
import http.cookiejar
import json
import os
import secrets
import struct
import time
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path('/etc/police-management/secrets/staging')
BASE = 'https://sunnytech.cloud'
OIDC = BASE + '/realms/police-staging/protocol/openid-connect'
CALLBACK = BASE + '/mfa-gate-callback'

class GateError(Exception):
    pass

def check(condition, message):
    if not condition:
        raise GateError(message)

class Forms(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.forms = []
        self.current = None
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'form':
            self.current = {'action': attrs.get('action'), 'fields': {}}
            self.forms.append(self.current)
        if tag == 'input' and self.current is not None and attrs.get('name'):
            if attrs.get('type') not in ('checkbox', 'radio') or 'checked' in attrs:
                self.current['fields'][attrs['name']] = attrs.get('value', '')

    def handle_endtag(self, tag):
        if tag == 'form':
            self.current = None

    def with_field(self, field):
        found = [form for form in self.forms if field in form['fields']]
        check(len(found) == 1, 'Expected exactly one ' + field + ' form')
        return found[0]

class Session:
    def __init__(self):
        self.opener = urllib.request.build_opener(SafeRedirects(), urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def request(self, url, fields=None):
        check(urllib.parse.urlsplit(url).scheme == 'https' and urllib.parse.urlsplit(url).netloc == 'sunnytech.cloud', 'Unexpected request destination')
        request = urllib.request.Request(url, data=None if fields is None else urllib.parse.urlencode(fields).encode())
        try:
            response = self.opener.open(request, timeout=25)
        except urllib.error.HTTPError as response:
            return response.code, response.geturl(), response.read().decode()
        return response.status, response.geturl(), response.read().decode()

class SafeRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        destination = urllib.parse.urlsplit(newurl)
        check(destination.scheme == 'https' and destination.netloc == 'sunnytech.cloud', 'Unexpected redirect destination')
        return super().redirect_request(req, fp, code, msg, headers, newurl)

def otp(seed):
    # Keycloak's hidden totpSecret is the raw secret; its QR/manual display is base32-encoded.
    raw = seed.encode()
    digest = hmac.new(raw, struct.pack('>Q', int(time.time()) // 30), hashlib.sha1).digest()
    offset = digest[-1] & 15
    number = (struct.unpack('>I', digest[offset:offset + 4])[0] & 0x7fffffff) % 1000000
    return str(number).zfill(6)

def authorize(session, prompt=None):
    verifier = secrets.token_urlsafe(48)
    state = secrets.token_urlsafe(24)
    fields = {'client_id': 'mfa-gate', 'redirect_uri': CALLBACK, 'response_type': 'code', 'scope': 'openid',
              'state': state, 'code_challenge_method': 'S256',
              'code_challenge': base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip('=')}
    if prompt:
        fields['prompt'] = prompt
    status, url, html = session.request(OIDC + '/auth?' + urllib.parse.urlencode(fields))
    return verifier, state, status, url, html

def submit(session, form, values):
    fields = {k: v for k, v in form['fields'].items() if 'cancel' not in k.lower()}
    fields.update(values)
    return session.request(form['action'], fields)

def no_code(url):
    check('code' not in urllib.parse.parse_qs(urllib.parse.urlsplit(url).query), 'Authorization code issued before valid MFA')

def run():
    check(os.geteuid() == 0, 'Run via sudo')
    credentials = json.loads((ROOT / 'mfa-gate.json').read_text())
    session = Session()
    verifier, state, status, url, html = authorize(session)
    check(status == 200, 'Login page unavailable')
    print('MFA_GATE: password page reached', flush=True)
    status, url, html = submit(session, Forms(html).with_field('password'), credentials)
    no_code(url)
    print('MFA_GATE: password alone did not issue a code', flush=True)
    forms = Forms(html)
    enrollment = any('totpSecret' in form['fields'] for form in forms.forms)
    if enrollment:
        form = forms.with_field('totpSecret')
        seed = form['fields']['totpSecret']
        check(seed, 'Enrollment seed missing')
        field = 'totp'
    else:
        check((ROOT / 'mfa-gate-otp').exists(), 'Existing OTP credential has no test escrow')
        seed = (ROOT / 'mfa-gate-otp').read_text()
        form = forms.with_field('otp')
        field = 'otp'
        # Use a new TOTP time step, not the enrollment code that may already be consumed.
        time.sleep(31 - time.time() % 30)
    check(16 <= len(seed) <= 256, 'Unexpected synthetic OTP secret format')
    bad = str((int(otp(seed)) + 12345) % 1000000).zfill(6)
    status, url, html = submit(session, form, {field: bad, 'userLabel': 'Synthetic VPS MFA gate'})
    no_code(url)
    form = Forms(html).with_field(field)
    if enrollment:
        seed = form['fields'].get('totpSecret', seed)
        target = ROOT / 'mfa-gate-otp'
        # Only this synthetic test identity is in scope. A failed enrollment may issue a new seed.
        if target.exists():
            target.chmod(0o600)
        with target.open('w') as stream:
            stream.write(seed)
        target.chmod(0o400)
    print('MFA_GATE: invalid OTP rejected', flush=True)
    status, url, html = submit(session, form, {field: otp(seed), 'userLabel': 'Synthetic VPS MFA gate'})
    query = urllib.parse.parse_qs(urllib.parse.urlsplit(url).query)
    if not query.get('code'):
        print(json.dumps({'stage': 'post-valid-otp', 'status': status,
            'path': urllib.parse.urlsplit(url).path,
            'form_fields': [list(item['fields']) for item in Forms(html).forms],
            'invalid_code_message': 'Invalid authenticator code' in html,
            'invalid_label_message': 'device name' in html.lower()}), flush=True)
    check(query.get('state') == [state] and bool(query.get('code')), 'Valid MFA did not return authorization code/state')
    status, _, body = session.request(OIDC + '/token', {'grant_type': 'authorization_code', 'client_id': 'mfa-gate',
        'redirect_uri': CALLBACK, 'code': query['code'][0], 'code_verifier': verifier})
    check(status == 200, 'PKCE token exchange rejected')
    tokens = json.loads(body)
    check(tokens.get('access_token') and tokens.get('refresh_token'), 'Token exchange incomplete')
    check(tokens.get('expires_in', 9999) <= 300, 'Token lifetime exceeds policy')
    status, _, _ = session.request(OIDC + '/logout', {'client_id': 'mfa-gate', 'refresh_token': tokens['refresh_token']})
    check(status in (200, 204), 'Backchannel logout failed')
    status, _, _ = session.request(OIDC + '/token', {'grant_type': 'refresh_token', 'client_id': 'mfa-gate', 'refresh_token': tokens['refresh_token']})
    check(status == 400, 'Refresh token survived logout')
    _, _, _, url, _ = authorize(session, prompt='none')
    check(urllib.parse.parse_qs(urllib.parse.urlsplit(url).query).get('error') == ['login_required'], 'SSO session survived logout')
    print(json.dumps({'result': 'PASS', 'first_enrollment': enrollment, 'password_only_blocked': True,
        'invalid_otp_rejected': True, 'pkce_exchange': True, 'short_token': True, 'global_logout': True}))

if __name__ == '__main__':
    try:
        run()
    except GateError as error:
        print('MFA_GATE_FAILED: ' + str(error))
        raise SystemExit(1)
    except Exception as error:
        # Do not print exception bodies: upstream HTML/URLs may contain OTP seeds or codes.
        print('MFA_GATE_FAILED: ' + type(error).__name__)
        raise SystemExit(1)
