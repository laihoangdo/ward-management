// Isolated Chrome + synthetic Keycloak identities only. No operational browser profile.
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';

const profile = mkdtempSync(join('C:/Users/admin/AppData/Local/Temp/opencode/', 'release-oidc-'));
const browser = spawn(
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  [
    '--headless=new',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--remote-debugging-port=59224',
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);
let socket;
let serial = 0;
const pending = new Map();
function send(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++serial;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP timeout: ${method}`));
    }, 30000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}
try {
  let descriptor;
  for (let i = 0; i < 100; i++) {
    try {
      descriptor = await (await fetch('http://localhost:59224/json/version')).json();
      break;
    } catch {
      await delay(100);
    }
  }
  assert.ok(descriptor, 'Isolated Chrome startup');
  socket = new WebSocket(descriptor.webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    const handler = pending.get(message.id);
    if (handler) {
      pending.delete(message.id);
      clearTimeout(handler.timer);
      if (message.error) handler.reject(new Error(message.error.message));
      else handler.resolve(message.result);
    }
  });
  const results = [];
  for (const role of ['superadmin', 'admin', 'sub-admin', 'officer']) {
    const { browserContextId } = await send('Target.createBrowserContext');
    try {
      const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId });
      const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
      await send('Page.enable', {}, sessionId);
      await send('Runtime.enable', {}, sessionId);
      const evaluate = async expression => {
        const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
        if (response.exceptionDetails) throw new Error('Browser evaluation failed (details redacted)');
        return response.result?.value;
      };
      const wait = async expression => {
        for (let i = 0; i < 150; i++) {
          try {
            const value = await evaluate(expression);
            if (value) return value;
          } catch {
            /* navigation replaces execution context */
          }
          await delay(200);
        }
        throw new Error(`Browser gate timed out for synthetic ${role}`);
      };
      await send('Page.navigate', { url: 'http://localhost:58080/oauth2/authorization/oidc' }, sessionId);
      const fields = await wait(
        `location.origin==='http://localhost:59080' && !!document.querySelector('#username') && !!document.querySelector('#password')`,
      );
      assert.ok(fields);
      await evaluate(
        `document.querySelector('#username').value=${JSON.stringify(role)};document.querySelector('#password').value='isolated-gate-only';document.querySelector('#kc-login').click();true`,
      );
      const me = await wait(`location.origin==='http://localhost:58080' && fetch('/api/rbac/me').then(async r=>r.ok?await r.json():null)`);
      assert.equal(me.role, role);
      const scopes = await evaluate(
        `Promise.all([99000001,99000002].map(id=>fetch('/api/gis/households/'+id+'/inspection-photos').then(r=>r.status)))`,
      );
      assert.deepEqual(scopes, [200, role === 'superadmin' ? 200 : 403]);
      results.push({ role, browserLogin: 'PASS', realScope: 'PASS' });
    } finally {
      await send('Target.disposeBrowserContext', { browserContextId });
    }
  }
  console.log(JSON.stringify({ browser: 'isolated headless Chrome', results }, null, 2));
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    try {
      await send('Browser.close');
    } catch {
      /* already closed */
    }
    socket.close();
  }
  for (const item of pending.values()) clearTimeout(item.timer);
  browser.kill();
}
