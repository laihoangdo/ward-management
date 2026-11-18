import axios from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { logoutBackendSession, mapAccountToGisUser } from './backendSession';

vi.mock('axios', () => ({ default: { post: vi.fn(), get: vi.fn() } }));

describe('GIS logout', () => {
  const assign = vi.fn();
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(axios.post).mockReset();
    vi.mocked(axios.get).mockReset();
    assign.mockReset();
  });
  const stubLocation = () => vi.stubGlobal('location', { ...window.location, origin: 'https://app.example', assign });

  it('follows the logout URL issued by the server and clears the cached user', async () => {
    stubLocation();
    localStorage.setItem('cskv_auth_session_user', '{}');
    vi.mocked(axios.post).mockResolvedValue({ data: { logoutUrl: 'https://id.example/logout?x=1' } });
    await logoutBackendSession();
    expect(assign).toHaveBeenCalledWith('https://id.example/logout?x=1');
    expect(localStorage.getItem('cskv_auth_session_user')).toBeNull();
  });

  it('still ends the identity provider session when the app session has already expired', async () => {
    stubLocation();
    localStorage.setItem('cskv_auth_session_user', '{}');
    vi.mocked(axios.post).mockRejectedValue(new Error('401'));
    vi.mocked(axios.get).mockResolvedValue({ data: { issuer: 'https://id.example/realms/r/', clientId: 'web_app' } });
    await logoutBackendSession();
    expect(assign).toHaveBeenCalledWith(
      'https://id.example/realms/r/protocol/openid-connect/logout?client_id=web_app&post_logout_redirect_uri=https%3A%2F%2Fapp.example',
    );
    expect(localStorage.getItem('cskv_auth_session_user')).toBeNull();
  });

  it('leaves the app even when no provider details are available', async () => {
    stubLocation();
    vi.mocked(axios.post).mockRejectedValue(new Error('offline'));
    vi.mocked(axios.get).mockRejectedValue(new Error('offline'));
    await logoutBackendSession();
    expect(assign).toHaveBeenCalledWith('/');
  });
});

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
