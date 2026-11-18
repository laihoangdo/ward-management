// Synthetic-only protocol gate. Never point this at operational services or identities.
import assert from 'node:assert/strict';

const app = 'http://localhost:58080';
const issuer = 'http://localhost:59080';
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=';

class Session {
  cookies = new Map();
  async request(url, options = {}) {
    const target = new URL(url, app);
    assert.ok([app, issuer].includes(target.origin), 'Refusing redirect outside isolated gate');
    const cookie = [...this.cookies.values()]
      .filter(c => target.pathname.startsWith(c.path))
      .map(c => `${c.name}=${c.value}`)
      .join('; ');
    const response = await fetch(target, { ...options, redirect: 'manual', headers: { Cookie: cookie, ...options.headers } });
    for (const value of response.headers.getSetCookie()) {
      const [pair, ...attributes] = value.split(';');
      const split = pair.indexOf('=');
      const name = pair.slice(0, split);
      const path =
        attributes
          .find(a => a.trim().toLowerCase().startsWith('path='))
          ?.trim()
          .slice(5) || '/';
      this.cookies.set(`${name}:${path}`, { name, value: pair.slice(split + 1), path });
    }
    return response;
  }
  async follow(response) {
    for (let i = 0; i < 15; i++) {
      if (![301, 302, 303, 307, 308].includes(response.status)) return response;
      response = await this.request(new URL(response.headers.get('location'), response.url));
    }
    throw new Error('Too many OIDC redirects');
  }
  async login(username) {
    const page = await this.follow(await this.request('/oauth2/authorization/oidc'));
    const html = await page.text();
    const action = html.match(/<form[^>]*action="([^"]+)"/)?.[1]?.replaceAll('&amp;', '&');
    assert.ok(action, `Keycloak login form required for synthetic ${username}`);
    const result = await this.follow(
      await this.request(action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ username, password: 'isolated-gate-only', credentialId: '' }),
      }),
    );
    assert.equal(new URL(result.url).origin, app, 'OIDC callback must return to isolated application');
    const me = await this.request('/api/rbac/me');
    assert.equal(me.status, 200, `Real RBAC lookup failed for synthetic ${username}`);
    assert.equal((await me.json()).role, username);
  }
  async mutate(path, method, body, csrf = true) {
    const token = [...this.cookies.values()].find(c => c.name === 'XSRF-TOKEN')?.value;
    assert.ok(token, 'Expected application CSRF cookie');
    return this.request(path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-XSRF-TOKEN': decodeURIComponent(token) } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }
}

const anonymous = new Session();
assert.equal((await anonymous.request('/api/rbac/me', { headers: { Accept: 'application/json' } })).status, 401);
const outcomes = [];
for (const role of ['superadmin', 'admin', 'sub-admin', 'officer']) {
  const session = new Session();
  await session.login(role);
  const inside = '/api/gis/households/99000001/inspection-photos';
  const outside = '/api/gis/households/99000002/inspection-photos';
  assert.equal((await session.request(inside)).status, 200);
  assert.equal((await session.request(outside)).status, role === 'superadmin' ? 200 : 403);
  assert.equal((await session.mutate(inside, 'POST', { url: png, category: 'general' }, false)).status, 403);
  const upload = await session.mutate(inside, 'POST', { url: png, category: 'general', caption: 'Synthetic OIDC gate' });
  assert.equal(upload.status, role === 'officer' ? 403 : 200, `Upload authorization for ${role}`);
  if (upload.status === 200) {
    const photo = await upload.json();
    const list = await session.request(inside);
    assert.equal(list.headers.get('cache-control'), 'no-store');
    assert.ok((await list.json()).some(item => item.id === photo.id && item.url === png));
    assert.equal((await session.mutate(`${outside}/${photo.id}`, 'DELETE')).status, role === 'superadmin' ? 404 : 403);
    assert.equal((await session.mutate(`${inside}/${photo.id}`, 'DELETE')).status, 204);
  }
  const logout = await session.mutate('/api/logout', 'POST');
  assert.equal(logout.status, 200);
  assert.equal((await session.request('/api/rbac/me', { headers: { Accept: 'application/json' } })).status, 401);
  outcomes.push({ role, result: 'PASS' });
}
console.log(JSON.stringify({ gate: 'real OIDC authorization-code/session + real RBAC + PostgreSQL', outcomes }, null, 2));
