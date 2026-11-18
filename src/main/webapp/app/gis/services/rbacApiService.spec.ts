import { afterEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { fetchRbacMe, saveDelegation, subscribeDynamicMenus, subscribeUsers } from './rbacApiService';

vi.mock('axios', () => ({ default: { get: vi.fn(), put: vi.fn(), isAxiosError: vi.fn(() => false) } }));
const events = vi.hoisted(() => ({ listeners: new Set<(event: { type: string; topics: string[] }) => void>() }));
vi.mock('./rbacEvents', () => ({
  resetRbacEventSession: vi.fn(),
  subscribeRbacEvents(listener: (event: { type: string; topics: string[] }) => void) {
    events.listeners.add(listener);
    return () => events.listeners.delete(listener);
  },
  invalidateRbac: (topics: string[]) => [...events.listeners].forEach(listener => listener({ type: 'change', topics })),
}));
const notify = (topics: string[]) => [...events.listeners].forEach(listener => listener({ type: 'change', topics }));
afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  localStorage.clear();
  events.listeners.clear();
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
      await vi.advanceTimersByTimeAsync(25);
      expect(callback).toHaveBeenCalledWith(retained);
      await vi.advanceTimersByTimeAsync(30000);
      expect(callback).toHaveBeenLastCalledWith(retained);
      expect(axios.get).toHaveBeenCalledTimes(1);
      notify(['users']);
      await vi.advanceTimersByTimeAsync(25);
      expect(axios.get).toHaveBeenCalledTimes(1);
      notify(['menus']);
      await vi.advanceTimersByTimeAsync(25);
      expect(axios.get).toHaveBeenCalledTimes(2);
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
  it('clears stale lists on invalidation failure and stops listening after unsubscribe', async () => {
    vi.useFakeTimers();
    vi.mocked(axios.get)
      .mockResolvedValueOnce({ data: [{ id: 'real' }] })
      .mockRejectedValue(new Error('offline'));
    const callback = vi.fn();
    const stop = subscribeUsers(callback);
    await vi.advanceTimersByTimeAsync(25);
    expect(callback).toHaveBeenLastCalledWith([{ id: 'real' }]);
    await vi.advanceTimersByTimeAsync(30000);
    expect(axios.get).toHaveBeenCalledTimes(1);
    notify(['users']);
    await vi.advanceTimersByTimeAsync(25);
    expect(callback).toHaveBeenLastCalledWith([]);
    stop();
    notify(['users']);
    await vi.advanceTimersByTimeAsync(30000);
    expect(axios.get).toHaveBeenCalledTimes(2);
  });
});
