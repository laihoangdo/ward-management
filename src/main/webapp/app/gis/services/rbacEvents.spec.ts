import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { subscribeRbacEvents, resetRbacEventSession } from './rbacEvents';

vi.mock('axios', () => ({ default: { getUri: () => '/api/rbac/events' } }));
class FakeSource {
  static instances: FakeSource[] = [];
  listeners = new Map<string, (event: unknown) => void>();
  close = vi.fn();
  onerror?: () => void;
  constructor(
    public url: string,
    public options: unknown,
  ) {
    FakeSource.instances.push(this);
  }
  addEventListener(name: string, listener: (event: unknown) => void) {
    this.listeners.set(name, listener);
  }
  send(name: string, data = {}) {
    this.listeners.get(name)?.({ data: JSON.stringify(data) });
  }
}
let stops: (() => void)[];
beforeEach(() => {
  vi.useFakeTimers();
  FakeSource.instances = [];
  stops = [];
  vi.stubGlobal('EventSource', FakeSource);
});
afterEach(() => {
  stops.forEach(stop => stop());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('shares one credentialed connection, ignores heartbeats, and closes only after the last subscriber leaves', async () => {
  const a = vi.fn(),
    b = vi.fn();
  const stopA = subscribeRbacEvents(a),
    stopB = subscribeRbacEvents(b);
  stops.push(stopA, stopB);
  expect(FakeSource.instances).toHaveLength(1);
  const stream = FakeSource.instances[0];
  expect(stream.url).toBe('/api/rbac/events');
  expect(stream.options).toEqual({ withCredentials: true });
  stream.send('ready');
  expect(a).toHaveBeenCalledWith(expect.objectContaining({ type: 'resync', force: true }));
  a.mockClear();
  b.mockClear();
  for (let i = 0; i < 10; i++) {
    await vi.advanceTimersByTimeAsync(20000);
    stream.send('ping');
  }
  expect(a).not.toHaveBeenCalled();
  expect(FakeSource.instances).toHaveLength(1);
  stopA();
  expect(stream.close).not.toHaveBeenCalled();
  stream.send('change', { topics: ['me'], version: 4 });
  expect(a).not.toHaveBeenCalled();
  expect(b).toHaveBeenCalledOnce();
  stopB();
  expect(stream.close).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(120000);
  expect(FakeSource.instances).toHaveLength(1);
});
it('backs off reconnects and forces a resync after disconnection without accepting old stream events', async () => {
  const listener = vi.fn();
  stops.push(subscribeRbacEvents(listener));
  const old = FakeSource.instances[0];
  old.send('ready');
  listener.mockClear();
  old.onerror?.();
  expect(old.close).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(1500);
  expect(FakeSource.instances).toHaveLength(2);
  old.send('change', { topics: ['me'] });
  expect(listener).not.toHaveBeenCalled();
  FakeSource.instances[1].send('ready');
  expect(listener).toHaveBeenCalledWith(expect.objectContaining({ type: 'resync', force: true }));
});
it('reconnects a silent connection and treats malformed notices as a forced resync', async () => {
  const listener = vi.fn();
  stops.push(subscribeRbacEvents(listener));
  FakeSource.instances[0].send('change', { topics: 'wrong' });
  expect(listener).toHaveBeenCalledWith(expect.objectContaining({ type: 'resync', force: true }));
  await vi.advanceTimersByTimeAsync(66500);
  expect(FakeSource.instances).toHaveLength(2);
});

it('checks only identity after an unchanged reconnect and refreshes all resources if it missed a change', async () => {
  const listener = vi.fn();
  stops.push(subscribeRbacEvents(listener));
  const same = { revision: 'instance:1', accessRevision: 'instance:1' };
  FakeSource.instances[0].send('ready', same);
  listener.mockClear();
  FakeSource.instances[0].onerror?.();
  await vi.advanceTimersByTimeAsync(1500);
  FakeSource.instances[1].send('ready', same);
  expect(listener).toHaveBeenLastCalledWith({ type: 'resync', topics: ['me'], force: false });
  FakeSource.instances[1].onerror?.();
  await vi.advanceTimersByTimeAsync(1500);
  FakeSource.instances[2].send('ready', { revision: 'instance:2', accessRevision: 'instance:2' });
  expect(listener).toHaveBeenLastCalledWith({ type: 'resync', topics: [], force: true });
});
it('drops an old authentication-session stream and creates a fresh one', async () => {
  const listener = vi.fn();
  stops.push(subscribeRbacEvents(listener));
  const old = FakeSource.instances[0];
  resetRbacEventSession();
  expect(old.close).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(0);
  expect(FakeSource.instances).toHaveLength(2);
  old.send('change', { topics: ['me'] });
  expect(listener).not.toHaveBeenCalled();
});
