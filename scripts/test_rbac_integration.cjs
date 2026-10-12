/** Local integration checks. Creates only UUID-prefixed fixtures, then cleans them up. */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const base = process.env.RBAC_TEST_URL || 'http://localhost:8081';
const issuer = 'http://localhost:9080/realms/jhipster';
const container = 'monolithic-keycloak-1';
const prefix = 'rbac-test-' + crypto.randomUUID().slice(0, 8);
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'rbac-integration-'));
const ids = [];
const areaIds = [];
const householdIds = [];
const residentIds = [];
const documentIds = [];
let clientId;
function kc(args) {
  try {
    return execFileSync('docker', ['exec', container, '/opt/keycloak/bin/kcadm.sh', ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    throw new Error('Keycloak test setup failed: ' + String(error.stderr || '').slice(0, 500));
  }
}
function kcBody(args, body) {
  const filename = path.join(temporary, crypto.randomUUID() + '.json');
  fs.writeFileSync(filename, JSON.stringify(body));
  const remote = '/tmp/' + path.basename(filename);
  execFileSync('docker', ['cp', filename, `${container}:${remote}`], { stdio: 'pipe' });
  try {
    return kc([...args, '-f', remote]);
  } finally {
    execFileSync('docker', ['exec', '--user', '0', container, 'rm', '-f', remote], { stdio: 'pipe' });
    fs.unlinkSync(filename);
  }
}
async function identity(suffix, role, overrides = {}) {
  const username = prefix + '-' + suffix,
    password = crypto.randomBytes(24).toString('hex');
  const id = kcBody(['create', 'users', '-r', 'jhipster', '-i'], {
    username,
    enabled: true,
    firstName: suffix,
    lastName: 'RBAC',
    email: username + '@example.invalid',
    emailVerified: true,
    ...overrides,
  });
  ids.push(id);
  kcBody(['update', `users/${id}/reset-password`, '-r', 'jhipster'], { type: 'password', value: password, temporary: false });
  kc(['add-roles', '-r', 'jhipster', '--uid', id, '--rolename', role]);
  return { id, username, password };
}
async function token(user) {
  const res = await fetch(issuer + '/protocol/openid-connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: prefix,
      username: user.username,
      password: user.password,
      scope: 'openid profile email',
    }),
  });
  assert.equal(res.status, 200, 'test identity must receive a token');
  return (await res.json()).access_token;
}
async function session(user) {
  const access = await token(user);
  const res = await fetch(base + '/api/rbac/me', { headers: { Authorization: 'Bearer ' + access } });
  const cookies = res.headers.getSetCookie();
  const cookie = cookies.map(c => c.split(';')[0]).join('; ');
  const csrf = cookies
    .find(c => c.startsWith('XSRF-TOKEN='))
    ?.split(';')[0]
    .slice(11);
  return { access, cookie, csrf };
}
async function call(session, method, url, body, expected = 200) {
  const res = await fetch(base + url, {
    method,
    headers: {
      Authorization: 'Bearer ' + session.access,
      Cookie: session.cookie,
      'X-XSRF-TOKEN': decodeURIComponent(session.csrf || ''),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  assert.equal(res.status, expected, `${method} ${url} expected ${expected}, got ${res.status}`);
  const text = await res.text();
  return text ? (res.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text) : null;
}
async function main() {
  let root;
  try {
    const scopes = JSON.parse(kc(['get', 'client-scopes', '-r', 'jhipster']));
    clientId = kcBody(['create', 'clients', '-r', 'jhipster', '-i'], {
      clientId: prefix,
      publicClient: true,
      standardFlowEnabled: false,
      directAccessGrantsEnabled: true,
      defaultClientScopes: ['jhipster', 'profile', 'email', 'roles', 'basic'],
    });
    const superUser = await identity('super', 'ROLE_SUPERADMIN');
    root = await session(superUser);
    const me = await call(root, 'GET', '/api/rbac/me');
    assert.equal(me.role, 'superadmin');
    const noEmail = await identity('no-email', 'ROLE_USER', { email: null, emailVerified: false });
    const noEmailSession = await session(noEmail);
    const noEmailAccount = await call(noEmailSession, 'GET', '/api/account');
    assert.equal(noEmailAccount.activated, true, 'accepted OIDC login must not be deactivated by email_verified=false');
    assert.equal(noEmailAccount.email, null, 'missing email must not become a UUID email');
    const officer = await identity('officer', 'ROLE_USER');
    const unassigned = await session(officer);
    assert.deepEqual(await call(unassigned, 'GET', '/api/households'), []);
    await call(unassigned, 'GET', '/api/rbac/users', undefined, 403);
    await call(unassigned, 'POST', '/api/rbac/users', { username: 'escalate', role: 'superadmin' }, 403);
    for (let i = 0; i < 2; i++) {
      const a = await call(root, 'POST', '/api/area-zones', { code: prefix + '-' + i, name: prefix, hamletName: prefix + '-' + i }, 201);
      areaIds.push(a.id);
    }
    const permissions = {
      canAddHouseholds: true,
      canUpdateInspection: true,
      canEditCoordinates: false,
      canScanOcr: false,
      canRenewDocs: false,
      canExportReports: false,
      canSendReminders: false,
      canManageStreets: false,
    };
    await call(root, 'PUT', `/api/rbac/users/${officer.id}/delegation`, {
      hamletIds: [areaIds[0]],
      assignedStreets: [],
      subAdminPermissions: permissions,
    });
    let regular = await session(officer);
    for (let i = 0; i < 2; i++) {
      const h = await call(
        root,
        'POST',
        '/api/households',
        {
          code: prefix + '-house-' + i,
          houseNumber: '1',
          street: prefix,
          hamlet: prefix + '-' + i,
          ownerName: 'RBAC Fixture',
          ownerPhone: '0000000000',
          type: 'RESIDENTIAL',
          hamletId: areaIds[i],
        },
        201,
      );
      householdIds.push(h.id);
    }
    const visible = await call(regular, 'GET', '/api/households?size=100');
    assert.deepEqual(
      visible.map(h => h.id),
      [householdIds[0]],
      'only assigned area may be listed',
    );
    assert.equal(await call(regular, 'GET', '/api/households/count'), 1);
    await call(regular, 'GET', `/api/households/${householdIds[1]}`, undefined, 403);
    await call(regular, 'PATCH', `/api/households/${householdIds[0]}`, { id: householdIds[0], latitude: 10, longitude: 106 }, 403);
    await call(regular, 'PATCH', `/api/households/${householdIds[1]}`, { id: householdIds[1], notes: 'forbidden' }, 403);
    await call(
      regular,
      'PUT',
      `/api/rbac/users/${officer.id}/delegation`,
      { hamletIds: [areaIds[1]], subAdminPermissions: permissions },
      403,
    );
    const profile = (await call(root, 'GET', '/api/rbac/users')).find(u => u.id === officer.id);
    await call(root, 'POST', '/api/rbac/users', { ...profile, status: 'locked' });
    // Even an already issued bearer token must be refused after disabling in Keycloak.
    await call(regular, 'GET', '/api/households', undefined, 403);
    const locked = (await call(root, 'GET', '/api/rbac/users')).find(u => u.id === officer.id);
    assert.equal(locked.status, 'locked');
    const unlocked = await call(root, 'POST', '/api/rbac/users', { ...locked, status: 'active' });
    regular = await session(officer);
    assert.equal((await call(regular, 'GET', '/api/households')).length, 1);
    const delegated = await call(root, 'PUT', `/api/rbac/users/${officer.id}/delegation`, {
      ...unlocked,
      subAdminPermissions: { ...permissions, canEditCoordinates: true },
    });
    await call(regular, 'PATCH', `/api/households/${householdIds[0]}`, { id: householdIds[0], latitude: 10, longitude: 106 });
    await call(root, 'PUT', `/api/rbac/users/${officer.id}/delegation`, { ...locked, subAdminPermissions: permissions }, 409);
    await call(regular, 'GET', '/api/rbac/export/households', undefined, 403);
    const exportProfile = await call(root, 'PUT', `/api/rbac/users/${officer.id}/delegation`, {
      ...delegated,
      subAdminPermissions: { ...permissions, canExportReports: true },
    });
    const csv = await call(regular, 'GET', '/api/rbac/export/households');
    assert.ok(csv.includes(prefix + '-house-0') && !csv.includes(prefix + '-house-1'), 'CSV must apply area scope');
    const restricted = await call(root, 'PUT', `/api/rbac/users/${officer.id}/delegation`, {
      ...exportProfile,
      assignedStreets: [prefix + '-other'],
    });
    assert.deepEqual(await call(regular, 'GET', '/api/households'), []);
    await call(
      regular,
      'POST',
      '/api/households',
      {
        code: prefix + '-forbidden',
        houseNumber: '2',
        street: prefix,
        hamlet: prefix,
        ownerName: 'RBAC Fixture',
        ownerPhone: '0000000000',
        type: 'RESIDENTIAL',
        hamletId: areaIds[0],
      },
      403,
    );
    await call(root, 'PUT', `/api/rbac/users/${officer.id}/delegation`, { ...restricted, assignedStreets: [] });

    // Provision through the application API, rather than only preparing fixtures through Keycloak.
    const created = await call(root, 'POST', '/api/rbac/users', {
      username: prefix + '-created',
      fullName: 'RBAC Fixture',
      email: prefix + '-created@example.invalid',
      role: 'sub-admin',
      temporaryPassword: crypto.randomBytes(24).toString('hex'),
      status: 'active',
      hamletIds: [areaIds[0]],
      subAdminPermissions: permissions,
    });
    ids.push(created.id);
    assert.equal(created.role, 'sub-admin');
    const resetPassword = crypto.randomBytes(24).toString('hex');
    kcBody(['update', `users/${created.id}/reset-password`, '-r', 'jhipster'], {
      type: 'password',
      value: resetPassword,
      temporary: false,
    });
    const manager = await session({ username: created.username, password: resetPassword });
    assert.ok((await call(manager, 'GET', '/api/rbac/users')).some(u => u.id === officer.id));
    const currentOfficer = (await call(manager, 'GET', '/api/rbac/users')).find(u => u.id === officer.id);
    await call(manager, 'PUT', `/api/rbac/users/${officer.id}/delegation`, { ...currentOfficer, hamletIds: [areaIds[1]] }, 403);
    await call(
      manager,
      'PUT',
      `/api/rbac/users/${officer.id}/delegation`,
      { ...currentOfficer, subAdminPermissions: { ...permissions, canEditCoordinates: true } },
      403,
    );
    const promoted = await call(root, 'POST', '/api/rbac/users', { ...created, role: 'admin' });
    assert.equal((await call(manager, 'GET', '/api/rbac/me')).role, 'admin', 'live promotion applies to existing token');
    await call(root, 'POST', '/api/rbac/users', { ...promoted, role: 'officer' });
    await call(manager, 'GET', '/api/rbac/users', undefined, 403);
    await call(root, 'POST', '/api/rbac/users', { ...promoted, role: 'admin' }, 409);
    assert.equal((await call(manager, 'GET', '/api/rbac/me')).status, 'active', 'stale edit must not disable identity');
    const resident = await call(
      root,
      'POST',
      '/api/residents',
      { fullName: 'RBAC Fixture', residenceType: 'PERMANENT', household: { id: householdIds[0] } },
      201,
    );
    residentIds.push(resident.id);
    assert.equal((await call(regular, 'GET', `/api/residents/${resident.id}`)).id, resident.id);
    await call(regular, 'PATCH', `/api/residents/${resident.id}`, { id: resident.id, household: { id: householdIds[1] } }, 403);
    const document = await call(root, 'POST', '/api/document-records', { docName: prefix, docType: 'TEST', status: 'EXPIRED' }, 201);
    documentIds.push(document.id);
    await call(regular, 'GET', `/api/document-records/${document.id}`, undefined, 403);
    await call(root, 'PUT', `/api/rbac/record-scope/document/${document.id}/${officer.id}`);
    assert.equal((await call(regular, 'GET', `/api/document-records/${document.id}`)).id, document.id);
    await call(regular, 'PATCH', `/api/document-records/${document.id}`, { id: document.id, status: 'VALID' }, 403);
    await call(regular, 'POST', `/api/rbac/documents/${document.id}/reminder`, undefined, 403);
    await call(root, 'DELETE', `/api/rbac/users/${created.id}`);
    assert.ok(!(await call(root, 'GET', '/api/rbac/users')).some(u => u.id === created.id));
    assert.ok((await call(root, 'GET', '/api/rbac/audit')).length > 0);
    console.log(
      'PASS: live roles, provision/delete, promote/demote, hierarchy, area/street list/count/write scope, resident move denial, document ownership, permission checks, scoped CSV, lock/unlock with existing tokens, immediate refresh, optimistic concurrency, server audit.',
    );
  } finally {
    if (root) {
      for (const id of documentIds) {
        try {
          await call(root, 'DELETE', '/api/document-records/' + id, undefined, 204);
        } catch {}
      }
      for (const id of residentIds) {
        try {
          await call(root, 'DELETE', '/api/residents/' + id, undefined, 204);
        } catch {}
      }
      for (const id of householdIds) {
        try {
          await call(root, 'DELETE', '/api/households/' + id, undefined, 204);
        } catch {}
      }
      for (const id of ids) {
        try {
          execFileSync(
            'docker',
            [
              'exec',
              'monolithic-postgresql-1',
              'psql',
              '-U',
              'Monolithic',
              '-d',
              'Monolithic',
              '-c',
              `DELETE FROM rbac_record_scope WHERE subject='${id}'; DELETE FROM rbac_profile WHERE subject='${id}'; DELETE FROM jhi_user_authority WHERE user_id='${id}'; DELETE FROM jhi_user WHERE id='${id}';`,
            ],
            { stdio: 'pipe' },
          );
        } catch {}
      }
      for (const id of areaIds) {
        try {
          await call(root, 'DELETE', '/api/area-zones/' + id, undefined, 204);
        } catch {}
      }
    }
    for (const id of ids) {
      try {
        kc(['delete', 'users/' + id, '-r', 'jhipster']);
      } catch {}
    }
    if (clientId) {
      try {
        kc(['delete', 'clients/' + clientId, '-r', 'jhipster']);
      } catch {}
    }
    for (const filename of fs.readdirSync(temporary)) fs.unlinkSync(path.join(temporary, filename));
    fs.rmdirSync(temporary);
  }
}
main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
