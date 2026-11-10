import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useIdleSessionTimeout } from './useIdleSessionTimeout';

describe('useIdleSessionTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('warns before the server session expires and signs out on idle', () => {
    const onTimeout = vi.fn();
    const { result } = renderHook(() => useIdleSessionTimeout(onTimeout));
    expect(result.current.secondsLeft).toBeNull();
    act(() => {
      vi.advanceTimersByTime(12 * 60_000 + 2_000);
    });
    expect(result.current.secondsLeft).not.toBeNull();
    expect(onTimeout).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(2 * 60_000);
    });
    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(result.current.secondsLeft).toBe(0);
  });

  it('real input activity resets the countdown; time alone never does', () => {
    const onTimeout = vi.fn();
    const { result } = renderHook(() => useIdleSessionTimeout(onTimeout));
    act(() => {
      vi.advanceTimersByTime(11 * 60_000);
    });
    act(() => {
      window.dispatchEvent(new Event('keydown'));
    });
    act(() => {
      vi.advanceTimersByTime(5 * 60_000);
    });
    expect(onTimeout).not.toHaveBeenCalled();
    expect(result.current.secondsLeft).toBeNull();
  });

  it('extend() clears an active warning', () => {
    const onTimeout = vi.fn();
    const { result } = renderHook(() => useIdleSessionTimeout(onTimeout));
    act(() => {
      vi.advanceTimersByTime(12 * 60_000 + 5_000);
    });
    expect(result.current.secondsLeft).not.toBeNull();
    act(() => {
      result.current.extend();
    });
    expect(result.current.secondsLeft).toBeNull();
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
