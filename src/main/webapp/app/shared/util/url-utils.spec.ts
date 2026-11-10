import { describe, expect, it } from 'vitest';

import { getLoginUrl, safeRedirectPath } from './url-utils';

describe('login URLs', () => {
  it('uses a router path for sign-in, not a protocol-relative URL', () => {
    expect(getLoginUrl()).toBe('/sign-in');
  });

  it('keeps in-app destinations and refuses other origins or loops', () => {
    expect(safeRedirectPath('/dashboard')).toBe('/dashboard');
    expect(safeRedirectPath('/dashboard?tab=field-3d-map')).toBe('/dashboard?tab=field-3d-map');
    for (const value of ['//evil.example/x', '/\\evil.example', 'https://evil.example', 'dashboard', '', null, undefined, '/sign-in']) {
      expect(safeRedirectPath(value)).toBeNull();
    }
  });

  it('drops the dotted path that the old protocol-relative link stored, so signed-in users are not sent to a refused URL', () => {
    expect(safeRedirectPath('/sunnytech.cloud/sign-in')).toBeNull();
    expect(safeRedirectPath('/dashboard?file=a.png')).toBe('/dashboard?file=a.png');
  });
});
