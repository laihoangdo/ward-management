// UI/UX responsive audit against a running local stack (Vite :9000 -> backend :8080 -> Keycloak).
// Usage (from tools/e2e, after `npm ci` and `npx playwright install chromium`):
//   AUDIT_USERS="cskv_thanh:user,admin:admin" node ui-audit.cjs
// Optional: AUDIT_BASE_URL (default http://localhost:9000, must be loopback).
// Output: target/ui-audit/ (gitignored). Screenshots may contain real household data: keep them local.
let chromium;
try { ({ chromium } = require('@playwright/test')); } catch { ({ chromium } = require('playwright')); }
const fs = require('fs'); const path = require('path');
const BASE = process.env.AUDIT_BASE_URL || 'http://localhost:9000';
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error('AUDIT_BASE_URL must be a loopback URL');
const ACCOUNTS = (process.env.AUDIT_USERS || '').split(',').filter(Boolean).map(p => { const i = p.indexOf(':'); return [p.slice(0, i), p.slice(i + 1)]; });
if (!ACCOUNTS.length) throw new Error('Set AUDIT_USERS="user:password,..."');
const OUT = path.resolve(__dirname, '../../target/ui-audit');
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, tablet: { width: 820, height: 1180 }, mobile: { width: 390, height: 844, isMobile: true, hasTouch: true } };
const PAGES = [
  ['home', '/'],
  ['overview', '/dashboard?tab=overview'],
  ['area-map', '/dashboard?tab=area-map'],
  ['field-3d-map', '/dashboard?tab=field-3d-map'],
  ['households', '/dashboard?tab=households'],
  ['residents', '/dashboard?tab=residents'],
  ['subjects', '/dashboard?tab=subjects'],
  ['facilities', '/dashboard?tab=facilities'],
  ['guidance', '/dashboard?tab=guidance'],
  ['documents', '/dashboard?tab=documents'],
  ['areas', '/dashboard?tab=areas'],
  ['logs', '/dashboard?tab=logs'],
  ['subadmin-delegation', '/dashboard?tab=subadmin-delegation'],
  ['superadmin-hub', '/dashboard?tab=superadmin-hub'],
  ['settings', '/dashboard?tab=settings'],
  ['roster', '/roster'],
  ['admin-health', '/admin/health'],
  ['admin-metrics', '/admin/metrics'],
  ['admin-docs', '/admin/docs'],
];

const measure = () => {
  const vw = window.innerWidth;
  const res = { vw, scrollW: document.documentElement.scrollWidth, docH: document.documentElement.scrollHeight };
  const vis = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0'; };
  const label = el => (el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || el.getAttribute('placeholder') || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 40);
  const ctrls = [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button], [tabindex]:not([tabindex="-1"])')].filter(vis);
  res.controls = ctrls.length;
  res.tiny = ctrls.filter(e => { const r = e.getBoundingClientRect(); return r.height < 24 || r.width < 24; }).map(label).slice(0, 12);
  res.under44 = ctrls.filter(e => { const r = e.getBoundingClientRect(); return r.height < 44; }).length;
  res.noName = ctrls.filter(e => (e.tagName === 'BUTTON' || e.tagName === 'A') && !(e.getAttribute('aria-label') || e.innerText.trim() || e.getAttribute('title'))).length;
  const texts = [...document.querySelectorAll('body *')].filter(e => e.childNodes.length && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && vis(e));
  res.textNodes = texts.length;
  res.smallText = texts.filter(e => parseFloat(getComputedStyle(e).fontSize) < 12).length;
  res.minFont = Math.min(...texts.map(e => parseFloat(getComputedStyle(e).fontSize)), 99);
  res.overflowEls = [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return vis(e) && r.right > vw + 2 && r.width < vw * 3; }).slice(0, 6).map(e => e.tagName + '.' + String(e.className).slice(0, 50));
  res.h1 = [...document.querySelectorAll('h1,h2')].filter(vis).map(e => e.innerText.trim().slice(0, 50)).slice(0, 4);
  res.tables = [...document.querySelectorAll('table')].filter(vis).length;
  res.fonts = [...new Set(texts.slice(0, 300).map(e => getComputedStyle(e).fontFamily.split(',')[0]))].slice(0, 4);
  return res;
};


async function login(ctx, user, pass, dir) {
  const page = await ctx.newPage();
  await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(dir, 'login-app.png') });
  await page.getByRole('button', { name: /Đăng nhập/ }).first().click();
  await page.waitForSelector('#username', { timeout: 30000 });
  await page.screenshot({ path: path.join(dir, 'login-keycloak.png') });
  await page.fill('#username', user); await page.fill('#password', pass);
  await Promise.all([page.waitForURL(u => u.toString().startsWith(BASE), { timeout: 30000 }).catch(() => {}), page.locator('#kc-login, [type=submit]').first().click()]);
  await page.waitForTimeout(1500);
  if (!page.url().startsWith(BASE)) { await page.screenshot({ path: path.join(dir, 'login-after.png') }); console.log('LOGIN STUCK at', page.url(), (await page.locator('h1,h2,.kc-feedback-text,#input-error').allInnerTexts()).join(' | ')); }
  await page.waitForLoadState('networkidle').catch(() => {});
  const acct = await page.evaluate(() => fetch('/api/account').then(r => r.status + ' ' + r.statusText).catch(e => String(e)));
  const me = await page.evaluate(() => fetch('/api/rbac/me').then(r => r.text()).catch(e => String(e)));
  console.log(user, 'account', acct, 'rbac/me', me.slice(0, 300));
  await page.close();
}
(async () => {
  const browser = await chromium.launch();
  fs.mkdirSync(OUT, { recursive: true });
  const report = {};
  for (const [user, pass] of ACCOUNTS) {
    const dir = path.join(OUT, user); fs.mkdirSync(dir, { recursive: true });
    const lctx = await browser.newContext({ viewport: VIEWPORTS.desktop });
    await login(lctx, user, pass, dir);
    const state = await lctx.storageState(); await lctx.close(); if (process.env.LOGIN_ONLY) continue;
    for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
      const ctx = await browser.newContext({ storageState: state, viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, locale: 'vi-VN' });
      for (const [name, url] of PAGES) {
        const page = await ctx.newPage(); const errors = []; const api = [];
        page.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 160)));
        page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
        page.on('response', r => { const u = new URL(r.url()); if (u.pathname.startsWith('/api') && r.status() >= 400) api.push(r.status() + ' ' + u.pathname); });
        const t0 = Date.now();
        try { await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 60000 }); } catch (e) { errors.push('goto: ' + e.message.slice(0, 80)); }
        await page.waitForTimeout(name.includes('map') ? 5000 : 1500);
        const m = await page.evaluate(measure).catch(e => ({ err: e.message }));
        m.finalUrl = page.url().replace(BASE, ''); m.loadMs = Date.now() - t0; m.errors = [...new Set(errors)].slice(0, 6); m.api = [...new Set(api)];
        await page.screenshot({ path: path.join(dir, `${vpName}-${name}.png`) });
        report[`${user}/${vpName}/${name}`] = m;
        console.log(user, vpName, name, m.finalUrl, JSON.stringify({ sw: m.scrollW, vw: m.vw, tiny: m.tiny?.length, small: m.smallText, err: m.errors.length, api: m.api.length, h: m.h1 }));
        await page.close();
      }
      await ctx.close();
    }
  }
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
})();
