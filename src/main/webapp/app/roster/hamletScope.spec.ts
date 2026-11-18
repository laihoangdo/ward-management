import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const load = async () => {
  vi.resetModules();
  return import('./hamletScope');
};

describe('hamlet view per account', () => {
  beforeEach(() => window.sessionStorage.clear());
  afterEach(() => window.sessionStorage.clear());

  it('opens every hamlet for the super admin and the commune for the commune chief', async () => {
    let scope = await load();
    scope.bindHamletScope({ login: 'root', role: 'superadmin' });
    expect(scope.activeHamlet()).toBe(scope.ALL_HAMLETS);

    scope = await load();
    scope.bindHamletScope({ login: 'chief', role: 'admin', hamletIds: [1, 2] });
    expect(scope.activeHamlet()).toBe(scope.ALL_HAMLETS);
  });

  it('leaves a hamlet officer on the server default (their hamlet)', async () => {
    const scope = await load();
    scope.bindHamletScope({ login: 'officer', role: 'sub-admin', hamletIds: [23] });
    expect(scope.activeHamlet()).toBe('');
  });

  it('keeps a choice for the account that made it and drops it for the next account in the same tab', async () => {
    let scope = await load();
    scope.bindHamletScope({ login: 'chief', role: 'admin', hamletIds: [1, 2] });
    scope.setActiveHamlet('2');

    scope = await load();
    scope.bindHamletScope({ login: 'chief', role: 'admin', hamletIds: [1, 2] });
    expect(scope.activeHamlet()).toBe('2');

    scope = await load();
    scope.bindHamletScope({ login: 'officer', role: 'officer', hamletIds: [23] });
    expect(scope.activeHamlet()).toBe('');
    expect(window.sessionStorage.getItem(scope.HAMLET_STORAGE_KEY)).toBeNull();
  });

  it('forgets the old ownerless key', async () => {
    window.sessionStorage.setItem('roster_hamlet_v1', '7');
    const scope = await load();
    expect(window.sessionStorage.getItem('roster_hamlet_v1')).toBeNull();
    scope.bindHamletScope({ login: 'officer', role: 'officer' });
    expect(scope.activeHamlet()).toBe('');
  });
});
