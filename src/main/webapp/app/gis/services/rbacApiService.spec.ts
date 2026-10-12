import { afterEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { fetchRbacMe, saveDelegation, subscribeDynamicMenus, subscribeUsers } from './rbacApiService';

vi.mock('axios', () => ({ default: { get: vi.fn(), put: vi.fn(), isAxiosError: vi.fn(() => false) } }));
afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  localStorage.clear();
});
describe('Server RBAC authority', () => {
  it('removes only the retired spatial menu from an existing server configuration', async () => {
    vi.useFakeTimers();
    const retained = [{ id: 'field-3d-map' }, { id: 'area-map' }, { id: 'households' }];
    vi.mocked(axios.get).mockResolvedValue({
      data: [retained[0], { id: 'spatial-3d-map' }, { id: 'vietmap-compare' }, ...retained.slice(1)],
    });
    const callback = vi.fn();
    const stop = subscribeDynamicMenus(callback);
    try {
      await vi.advanceTimersByTimeAsync(0);
      expect(callback).toHaveBeenCalledWith(retained);
      await vi.advanceTimersByTimeAsync(30000);
      expect(callback).toHaveBeenLastCalledWith(retained);
    } finally {
      stop();
    }
  });
  it('reads the server identity despite a cached local superadmin', async () => {
    localStorage.setItem('cskv_auth_session_user', JSON.stringify({ role: 'superadmin' }));
    vi.mocked(axios.get).mockResolvedValue({ data: { id: 'oidc-subject', role: 'officer' } });
    expect((await fetchRbacMe()).role).toBe('officer');
    expect(axios.get).toHaveBeenCalledWith('/api/rbac/me');
  });
  it('sends versioned delegation to the server and returns the saved version', async () => {
    const user = { id: 'subject', version: 4 } as Parameters<typeof saveDelegation>[0];
    vi.mocked(axios.put).mockResolvedValue({ data: { ...user, version: 5 } });
    expect((await saveDelegation(user)).version).toBe(5);
    expect(axios.put).toHaveBeenCalledWith('/api/rbac/users/subject/delegation', user);
  });
  it('clears stale lists on failure and stops polling after unsubscribe', async () => {
    vi.useFakeTimers();
    vi.mocked(axios.get)
      .mockResolvedValueOnce({ data: [{ id: 'real' }] })
      .mockRejectedValue(new Error('offline'));
    const callback = vi.fn();
    const stop = subscribeUsers(callback);
    await vi.advanceTimersByTimeAsync(0);
    expect(callback).toHaveBeenLastCalledWith([{ id: 'real' }]);
    await vi.advanceTimersByTimeAsync(30000);
    expect(callback).toHaveBeenLastCalledWith([]);
    stop();
    await vi.advanceTimersByTimeAsync(30000);
    expect(axios.get).toHaveBeenCalledTimes(2);
  });
});
