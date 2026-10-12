import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decryptAes, encryptAes } from './cryptoUtils';

describe('AES-GCM persisted ciphertext compatibility', () => {
  beforeEach(() => vi.stubGlobal('crypto', webcrypto));
  afterEach(() => vi.unstubAllGlobals());

  it('round-trips synthetic Unicode text through the stored hex format without fallback', async () => {
    const plaintext = 'Dữ liệu kiểm thử — synthetic only';
    const ciphertext = await encryptAes(plaintext, 'synthetic-test-key');
    expect(ciphertext).toMatch(/^ENC_AES256:[0-9a-f]{24}:[0-9a-f]+$/);
    expect(await decryptAes(ciphertext, 'synthetic-test-key')).toBe(plaintext);
  });

  it('uses independent IVs while preserving decryptability', async () => {
    const first = await encryptAes('synthetic record', 'synthetic-test-key');
    const second = await encryptAes('synthetic record', 'synthetic-test-key');
    expect(first).not.toBe(second);
    expect(await decryptAes(first, 'synthetic-test-key')).toBe('synthetic record');
    expect(await decryptAes(second, 'synthetic-test-key')).toBe('synthetic record');
  });
});
