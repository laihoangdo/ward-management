import { describe, expect, it } from 'vitest';
import { mapAccountToGisUser } from './backendSession';

describe('GIS backend identity', () => {
  it('does not authenticate disabled accounts or accounts without a recognized role', () => {
    expect(mapAccountToGisUser({ login: 'officer', activated: false, authorities: ['ROLE_ADMIN'] })).toBeNull();
    expect(mapAccountToGisUser({ login: 'officer', activated: true, authorities: [] })).toBeNull();
  });

  it('does not trust a cached superadmin session or a seeded username', () => {
    localStorage.setItem('cskv_auth_session_user', JSON.stringify({ role: 'superadmin' }));
    localStorage.setItem('cskv_app_users', JSON.stringify([{ username: 'superadmin', role: 'superadmin' }]));
    const user = mapAccountToGisUser({ login: 'superadmin', activated: true, authorities: ['ROLE_USER'] });
    expect(user?.role).toBe('officer');
    expect(user?.assignedHamlets).toEqual([]);
    localStorage.clear();
  });

  it('requires an explicit backend authority for superadmin', () => {
    expect(mapAccountToGisUser({ login: 'admin', activated: true, authorities: ['ROLE_ADMIN'] })?.role).toBe('admin');
    expect(mapAccountToGisUser({ login: 'chief', activated: true, authorities: ['ROLE_SUPERADMIN'] })?.role).toBe('superadmin');
  });
});
