import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';

it('keeps sample operational datasets and legacy business caches out of application runtime imports', () => {
  const root = existsSync(resolve(process.cwd(), 'src/main/webapp/app'))
    ? resolve(process.cwd(), 'src/main/webapp/app')
    : resolve(process.cwd(), 'app');
  const violations: string[] = [];
  const inspect = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        inspect(path);
        continue;
      }
      if (!/\.(?:tsx?|js)$/.test(entry.name) || /\.(?:spec|test)\./.test(entry.name)) continue;
      const source = readFileSync(path, 'utf8');
      if (
        /from\s+['"][^'"]*(?:initialAuthData|initialAuditLogs)['"]/.test(source) ||
        /cskv_(?:households_cache|documents_cache|inspection_photos_|officer_profile)/.test(source)
      )
        violations.push(path);
    }
  };
  inspect(root);
  expect(violations).toEqual([]);
});
