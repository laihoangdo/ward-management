import { test as base, expect } from '@playwright/test';

export const test = base.extend<{ diagnostics: void }>({
  diagnostics: [
    async ({ page }, use, testInfo) => {
      const events: string[] = [];
      const pathOnly = (value: string) => {
        try {
          const url = new URL(value);
          return `${url.hostname}${url.pathname}`;
        } catch {
          return 'unparseable-url';
        }
      };
      page.on('console', message => {
        if (message.type() === 'error') events.push('browser console error (content redacted)');
      });
      page.on('pageerror', () => events.push('uncaught browser exception (content redacted)'));
      page.on('requestfailed', request => events.push(`request failed: ${pathOnly(request.url())}`));
      page.on('response', response => {
        if (response.status() >= 500) events.push(`HTTP ${response.status()}: ${pathOnly(response.url())}`);
      });
      await use();
      if (testInfo.status !== testInfo.expectedStatus) {
        await testInfo.attach('sanitized-browser-diagnostics', { body: events.join('\n'), contentType: 'text/plain' });
      }
    },
    { auto: true },
  ],
});
export { expect };
