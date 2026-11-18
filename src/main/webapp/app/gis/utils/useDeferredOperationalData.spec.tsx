import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { loadOperationalData } from './operationalData';
import { useDeferredOperationalData } from './useDeferredOperationalData';

vi.mock('./operationalData', () => ({ loadOperationalData: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
const results = [0, 1, 2, 3].map(() => ({ status: 'fulfilled', value: [] })) as Awaited<ReturnType<typeof loadOperationalData>>;

it('skips complete datasets on overview/list, loads once for a full-data consumer, and reuses them on return', async () => {
  vi.mocked(loadOperationalData).mockResolvedValue(results);
  const apply = vi.fn();
  const loading = vi.fn();
  const { result, rerender } = renderHook(({ needed }) => useDeferredOperationalData(needed, apply, loading), {
    initialProps: { needed: false },
  });
  expect(loadOperationalData).not.toHaveBeenCalled();
  rerender({ needed: false });
  expect(loadOperationalData).not.toHaveBeenCalled();
  rerender({ needed: true });
  await waitFor(() => expect(result.current.hasLoaded).toBe(true));
  expect(apply).toHaveBeenCalledWith(results);
  rerender({ needed: false });
  rerender({ needed: true });
  expect(loadOperationalData).toHaveBeenCalledOnce();
});

it('shares an in-flight load across navigation/refresh and delivers the data after navigation', async () => {
  let resolve!: (value: typeof results) => void;
  vi.mocked(loadOperationalData).mockReturnValue(
    new Promise(done => {
      resolve = done;
    }),
  );
  const apply = vi.fn();
  const { result, rerender } = renderHook(({ needed }) => useDeferredOperationalData(needed, apply, vi.fn()), {
    initialProps: { needed: true },
  });
  let first: Promise<typeof results>;
  let second: Promise<typeof results>;
  act(() => {
    first = result.current.load();
    second = result.current.load();
  });
  expect(first!).toBe(second!);
  rerender({ needed: false });
  await act(async () => {
    resolve(results);
    await first;
  });
  expect(apply).toHaveBeenCalledOnce();
  expect(result.current.hasLoaded).toBe(true);
  expect(loadOperationalData).toHaveBeenCalledOnce();
});

it('does not apply a previous account/unmounted consumer response', async () => {
  let resolve!: (value: typeof results) => void;
  vi.mocked(loadOperationalData).mockReturnValue(
    new Promise(done => {
      resolve = done;
    }),
  );
  const apply = vi.fn();
  const loading = vi.fn();
  const { unmount } = renderHook(() => useDeferredOperationalData(true, apply, loading));
  unmount();
  await act(() => {
    resolve(results);
    return Promise.resolve();
  });
  expect(apply).not.toHaveBeenCalled();
  expect(loading).toHaveBeenCalledTimes(1);
});
