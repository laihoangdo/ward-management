import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { subscribeRbacResource } from './rbacSubscription';
const events = vi.hoisted(() => ({ listeners: new Set<(event: unknown) => void>() }));
vi.mock('./rbacEvents', () => ({
  subscribeRbacEvents(listener: (event: unknown) => void) {
    events.listeners.add(listener);
    return () => events.listeners.delete(listener);
  },
}));
const notify = (event: unknown) => [...events.listeners].forEach(listener => listener(event));
let stop: () => void;
beforeEach(() => {
  vi.useFakeTimers();
  stop = () => {};
});
afterEach(() => {
  stop();
  events.listeners.clear();
  vi.useRealTimers();
});
it('never polls idle resources and reloads only its topic or a reconnect', async () => {
  const read = vi.fn().mockResolvedValue([]),
    data = vi.fn();
  stop = subscribeRbacResource('users', read, data, vi.fn());
  await vi.advanceTimersByTimeAsync(600000);
  expect(read).toHaveBeenCalledOnce();
  notify({ type: 'change', topics: ['menus'] });
  await vi.advanceTimersByTimeAsync(25);
  expect(read).toHaveBeenCalledOnce();
  notify({ type: 'change', topics: ['users'] });
  await vi.advanceTimersByTimeAsync(25);
  expect(read).toHaveBeenCalledTimes(2);
  notify({ type: 'resync' });
  await vi.advanceTimersByTimeAsync(25);
  expect(read).toHaveBeenCalledTimes(3);
  notify({ type: 'resync', topics: ['me'] });
  await vi.advanceTimersByTimeAsync(25);
  expect(read).toHaveBeenCalledTimes(3);
});
it('coalesces a burst during an in-flight read without losing the newest invalidation', async () => {
  let resolve!: (value: string) => void;
  const read = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise(done => {
          resolve = done;
        }),
    )
    .mockResolvedValue('new');
  const data = vi.fn();
  stop = subscribeRbacResource('me', read, data, vi.fn());
  await vi.advanceTimersByTimeAsync(25);
  for (let i = 0; i < 10; i++) notify({ type: 'change', topics: ['me'] });
  await vi.advanceTimersByTimeAsync(1000);
  expect(read).toHaveBeenCalledOnce();
  resolve('old');
  await vi.advanceTimersByTimeAsync(25);
  expect(read).toHaveBeenCalledTimes(2);
  expect(data).toHaveBeenLastCalledWith('new');
  expect(data).not.toHaveBeenCalledWith('old');
});
it('invalidates access immediately on a rights event and aborts an unmounted session request', async () => {
  let resolve!: (value: string) => void;
  const read = vi.fn().mockImplementation(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  const data = vi.fn(),
    invalid = vi.fn(),
    error = vi.fn();
  stop = subscribeRbacResource('me', read, data, error, invalid);
  await vi.advanceTimersByTimeAsync(25);
  notify({ type: 'change', topics: ['me'], force: false });
  expect(invalid).not.toHaveBeenCalled();
  notify({ type: 'change', topics: ['me'], force: true });
  expect(invalid).toHaveBeenCalledOnce();
  const signal = read.mock.calls[0][0] as AbortSignal;
  stop();
  expect(signal.aborted).toBe(true);
  resolve('old-account');
  await vi.advanceTimersByTimeAsync(1000);
  expect(data).not.toHaveBeenCalled();
  expect(error).not.toHaveBeenCalled();
});
