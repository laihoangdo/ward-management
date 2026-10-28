/* global document, window */
// Read-only roster API smoke test. Temporary OIDC identities are cleaned up; no roster fixtures are inserted.
const { execFileSync } = require('node:child_process');
const { randomUUID, randomBytes } = require('node:crypto');
const assert = require('node:assert/strict');
const database = require('./database-context.cjs');
const base = process.env.TC2_TEST_URL || 'http://localhost:8080';
const issuer = 'http://localhost:9080/realms/jhipster';
const prefix = 'tc2-api-test-' + randomUUID().slice(0, 8);
const users = [];
let client;
let root;
function kc(args, body) {
  if (body === undefined)
    return execFileSync('docker', ['exec', 'monolithic-keycloak-1', '/opt/keycloak/bin/kcadm.sh', ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  return execFileSync('docker', ['exec', '-i', 'monolithic-keycloak-1', '/opt/keycloak/bin/kcadm.sh', ...args, '-f', '-'], {
    input: JSON.stringify(body),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}
async function identity(suffix, role) {
  const username = prefix + '-' + suffix,
    password = randomBytes(24).toString('hex');
  const id = kc(['create', 'users', '-r', 'jhipster', '-i'], {
    username,
    enabled: true,
    firstName: 'TC2',
    lastName: 'API fixture',
    email: username + '@example.invalid',
    emailVerified: true,
  });
  users.push(id);
  kc(['update', `users/${id}/reset-password`, '-r', 'jhipster'], { type: 'password', value: password, temporary: false });
  kc(['add-roles', '-r', 'jhipster', '--uid', id, '--rolename', role]);
  const response = await fetch(issuer + '/protocol/openid-connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'password', client_id: prefix, username, password, scope: 'openid profile email' }),
  });
  assert.equal(response.status, 200, 'Fixture token');
  const token = (await response.json()).access_token;
  const res = await fetch(base + '/api/rbac/me', { headers: { Authorization: 'Bearer ' + token } });
  assert.equal(res.status, 200, 'Fixture profile');
  const cookies = res.headers.getSetCookie();
  return {
    id,
    token,
    cookie: cookies.map(c => c.split(';')[0]).join('; '),
    csrf:
      cookies
        .find(c => c.startsWith('XSRF-TOKEN='))
        ?.split(';')[0]
        .slice(11) || '',
  };
}
async function call(who, path, status = 200, body) {
  const res = await fetch(base + path, {
    method: body ? 'PUT' : 'GET',
    headers: {
      Authorization: 'Bearer ' + who.token,
      Cookie: who.cookie,
      'X-XSRF-TOKEN': decodeURIComponent(who.csrf),
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  assert.equal(res.status, status, `${path}: expected ${status}, received ${res.status}`);
  if (status !== 200) return null;
  return res.headers.get('content-type')?.includes('json') ? res.json() : res.text();
}
(async () => {
  try {
    client = kc(['create', 'clients', '-r', 'jhipster', '-i'], {
      clientId: prefix,
      publicClient: true,
      standardFlowEnabled: false,
      directAccessGrantsEnabled: true,
      defaultClientScopes: ['jhipster', 'profile', 'email', 'roles', 'basic'],
    });
    root = await identity('super', 'ROLE_SUPERADMIN');
    const outsider = await identity('outside', 'ROLE_USER');
    await call(outsider, '/api/roster/overview', 403);
    const overview = await call(root, '/api/roster/overview');
    assert.ok(overview.residents >= 5073);
    assert.ok(overview.review_rows >= 62);
    const households = await call(root, '/api/roster/households');
    assert.equal(households.items.length, 30);
    const detail = await call(root, '/api/roster/households/' + households.items[0].id);
    assert.ok(Array.isArray(detail.members));
    if (detail.members.length) {
      const person = await call(root, '/api/roster/residents/' + detail.members[0].id);
      assert.ok(Array.isArray(person.records));
      assert.ok(person.identities.every(i => !('number_ciphertext' in i) && !('number_lookup' in i)));
    }
    const people = await call(root, '/api/roster/residents?page=0');
    assert.equal(people.items.length, 30);
    assert.equal(people.total, overview.residents);
    const individual = await call(root, '/api/roster/residents/' + people.items[0].id);
    assert.ok(Array.isArray(individual.memberships));
    await call(root, '/api/roster/entity-history/resident/' + individual.id);
    const legacyResponse = await fetch(base + '/api/households', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + root.token, 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(legacyResponse.status, 409);
    const gisOverview = await call(root, '/api/gis/households/overview');
    assert.equal(gisOverview.fallbackHouseholds, 0);
    const collections = await call(root, '/api/roster/collections');
    const collection = await call(
      root,
      '/api/roster/collections/' + (collections.find(c => c.id === '54a50921-1bf8-422a-a792-62be6e014d32') || collections[0]).id,
    );
    assert.equal(collection.batches.length, 4);
    const reviews = await call(
      root,
      '/api/roster/collections/' + (collections.find(c => c.id === '54a50921-1bf8-422a-a792-62be6e014d32') || collections[0]).id + '/rows',
    );
    assert.ok(reviews.length > 0);
    assert.ok(reviews.every(r => !('identity' in r.data)));
    const source = await call(root, '/api/roster/source/' + reviews[0].id);
    assert.ok(source.raw);
    assert.ok(!('raw_ciphertext' in source));
    const map = await call(root, '/api/roster/map');
    assert.equal(map.features.length, overview.households);
    const report = await call(root, '/api/roster/report?from=2026-10-19&to=2026-10-21');
    assert.equal(report.timeBasis, 'RECORDED_AT');
    const history = await call(root, '/api/roster/history?from=2026-10-19&to=2026-10-21');
    assert.ok(history.length > 0);
    assert.ok(typeof history[0].after_data === 'object');
    assert.ok((await call(root, '/api/roster/report.csv?from=2026-10-19&to=2026-10-21')).includes('BASELINE_IMPORT'));
    if (process.env.TC2_BROWSER_TEST === 'true') {
      const { chromium } = require('../tools/e2e/node_modules/@playwright/test');
      const browser = await chromium.launch({ headless: true });
      try {
        const context = await browser.newContext({
          viewport: { width: 1440, height: 1000 },
          extraHTTPHeaders: { Authorization: 'Bearer ' + root.token },
        });
        const page = await context.newPage();
        await page.goto((process.env.TC2_UI_URL || 'http://localhost:9000') + '/roster');
        try {
          await page.getByRole('heading', { name: 'Danh sách hộ dân · Trung Chánh 2' }).waitFor();
        } catch (error) {
          await page.screenshot({ path: '.tc2-private/roster-browser-error.png', fullPage: true });
          throw error;
        }
        await page.getByRole('button', { name: 'Quản lý nhân khẩu', exact: true }).click();
        await page.getByRole('heading', { name: 'Quản lý nhân khẩu · Trung Chánh 2', exact: true }).waitFor();
        await page.getByRole('button', { name: '+ Thêm nhân khẩu', exact: true }).click();
        await page.getByRole('dialog').waitFor();
        await page.getByRole('button', { name: 'Hủy', exact: true }).click();
        await page.getByRole('button', { name: 'Danh sách hộ dân', exact: true }).click();
        await page.getByRole('button', { name: '+ Thêm hộ', exact: true }).click();
        await page.getByRole('dialog').waitFor();
        await page.getByRole('button', { name: 'Hủy', exact: true }).click();
        await page.getByRole('button', { name: 'Nhập Excel / đối soát', exact: true }).click();
        await page.getByRole('heading', { name: 'Nhập nguồn Excel', exact: true }).waitFor();
        await page.screenshot({ path: '.tc2-private/roster-import-desktop.png', fullPage: true });
        await page.setViewportSize({ width: 390, height: 844 });
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
          true,
          'Mobile page must not overflow horizontally',
        );
        await page.screenshot({ path: '.tc2-private/roster-import-mobile.png', fullPage: true });
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.goto((process.env.TC2_UI_URL || 'http://localhost:9000') + '/dashboard');
        await page.locator('#nav-households').click();
        await page.getByRole('heading', { name: 'Danh sách hộ dân · Trung Chánh 2', exact: true }).waitFor();
        await page.locator('.roster-list-pane tbody button').first().click();
        const detailPane = page.getByRole('complementary', { name: 'Thông tin và thao tác hồ sơ' });
        await detailPane.getByRole('button', { name: 'Sửa hộ', exact: true }).waitFor();
        const listBounds = await page.locator('.roster-list-pane').boundingBox();
        const detailBounds = await detailPane.boundingBox();
        assert.ok(detailBounds.x >= listBounds.x + listBounds.width, 'Details must be on the right');
        assert.ok(Math.abs(detailBounds.width - listBounds.width) < 3, 'Two panes must share the width equally');
        await page.screenshot({ path: '.tc2-private/roster-split-layout-check.png', fullPage: true });
        console.log('SPLIT_BOUNDS', JSON.stringify({ list: listBounds, detail: detailBounds }));
        assert.ok(Math.abs(detailBounds.y - listBounds.y) < 3, 'Two panes must align');
        await page.screenshot({ path: '.tc2-private/unified-households-desktop.png', fullPage: true });
        await detailPane.getByRole('button', { name: 'Đóng chi tiết', exact: true }).click();
        assert.equal(await detailPane.count(), 0);
        await page.locator('#nav-residents').click();
        await page.getByRole('heading', { name: 'Quản lý nhân khẩu · Trung Chánh 2', exact: true }).waitFor();
        await page.locator('.roster-list-pane tbody button').first().click();
        await detailPane.getByRole('button', { name: 'Sửa thông tin cá nhân', exact: true }).waitFor();
        await page.screenshot({ path: '.tc2-private/unified-residents-desktop.png', fullPage: true });
        await page.setViewportSize({ width: 390, height: 844 });
        assert.equal(await page.locator('.roster-list-pane').isVisible(), false);
        assert.equal(await detailPane.isVisible(), true);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
        await page.screenshot({ path: '.tc2-private/unified-resident-detail-mobile.png', fullPage: true });
        await detailPane.getByRole('button', { name: 'Đóng chi tiết', exact: true }).click();
        assert.equal(await page.locator('.roster-list-pane').isVisible(), true);
        await context.close();
        console.log('PASS: real browser route, create dialog, import page and mobile width. No roster writes.');
      } finally {
        await browser.close();
      }
    }
    console.log(
      'PASS: live authenticated roster endpoints, source decryption, history JSON, report CSV, map points and out-of-area denial. No roster records changed.',
    );
  } finally {
    for (const id of users) {
      if (!/^[0-9a-f-]{36}$/.test(id)) continue;
      try {
        execFileSync(
          'docker',
          [
            'exec',
            database.container,
            'psql',
            '-U',
            'Monolithic',
            '-d',
            'Monolithic',
            '-c',
            `DELETE FROM rbac_assignment WHERE subject='${id}'; DELETE FROM rbac_record_scope WHERE subject='${id}'; DELETE FROM rbac_profile WHERE subject='${id}'; DELETE FROM jhi_user_authority WHERE user_id='${id}'; DELETE FROM jhi_user WHERE id='${id}';`,
          ],
          { stdio: 'pipe' },
        );
      } catch {
        /* fixture cleanup may already have completed */
      }
      try {
        kc(['delete', 'users/' + id, '-r', 'jhipster']);
      } catch {
        /* fixture cleanup may already have completed */
      }
    }
    if (client) {
      try {
        kc(['delete', 'clients/' + client, '-r', 'jhipster']);
      } catch {
        /* fixture cleanup may already have completed */
      }
    }
  }
})().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
