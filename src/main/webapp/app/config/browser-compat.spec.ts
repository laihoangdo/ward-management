import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { gzipSync, gunzipSync } from 'node:zlib';
import { postcssBrowserCompat } from '../../../../../scripts/postcss-browser-compat';
import { compatibleOcrLanguageAsset } from '../../../../../scripts/ocr-language-compat';

it('honors only PostCSS browser-disabled modules, not arbitrary Node imports', () => {
  const plugin = postcssBrowserCompat();
  const id = plugin.resolveId('path', 'C:\\project\\node_modules\\postcss\\lib\\input.js');
  expect(id).toBeTruthy();
  expect(plugin.load(id!)).toBe('module.exports = {};');
  expect(plugin.resolveId('source-map-js', '/project/node_modules/postcss/lib/map-generator.js')).toBe(id);
  expect(plugin.resolveId('path', '/project/src/app.ts')).toBeNull();
  expect(plugin.resolveId('fs', '/project/node_modules/another-package/index.js')).toBeNull();
  expect(plugin.resolveId('node:path', '/project/src/app.ts')).toBeNull();
});

it.each(['eng', 'vie'])('preserves %s language weights and offsets while removing only obsolete config lines', language => {
  const require = createRequire(`${process.cwd()}/package.json`);
  const file = require.resolve(`@tesseract.js-data/${language}/4.0.0_best_int/${language}.traineddata.gz`);
  const compressed = readFileSync(file);
  const original = gunzipSync(compressed);
  const fixed = gunzipSync(compatibleOcrLanguageAsset(compressed));
  expect(fixed.length).toBe(original.length);
  const count = original.readInt32LE(0);
  expect(fixed.subarray(0, 4 + count * 8)).toEqual(original.subarray(0, 4 + count * 8));
  const start = Number(original.readBigInt64LE(4));
  if (start === -1) {
    expect(fixed.equals(original)).toBe(true);
    return;
  }
  const offsets = Array.from({ length: count }, (_, index) => Number(original.readBigInt64LE(4 + index * 8)));
  const end = Math.min(original.length, ...offsets.filter(offset => offset > start));
  expect(fixed.subarray(end).equals(original.subarray(end))).toBe(true);
  expect(fixed.subarray(start, end).toString()).not.toMatch(/language_model_ngram_on|classify_misfit_junk_penalty/);
});

it('rejects a malformed language asset instead of corrupting it', () => {
  expect(() => compatibleOcrLanguageAsset(gzipSync(Buffer.alloc(8)))).toThrow('header');
});
