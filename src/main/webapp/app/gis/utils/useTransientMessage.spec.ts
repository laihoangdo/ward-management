import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTransientMessage } from './useTransientMessage';

describe('transient message lifecycle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('keeps the newer message until its own deadline', () => {
    const { result } = renderHook(useTransientMessage);
    act(() => result.current[1]('first', 5000));
    act(() => vi.advanceTimersByTime(4000));
    act(() => result.current[1]('second', 3000));
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current[0]).toBe('second');
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current[0]).toBeNull();
  });

  it('cancels expiry when explicitly cleared or replaced by a persistent message', () => {
    const { result } = renderHook(useTransientMessage);
    act(() => result.current[1]('temporary', 5000));
    act(() => result.current[1](null));
    expect(vi.getTimerCount()).toBe(0);
    act(() => result.current[1]('temporary', 5000));
    act(() => result.current[1]('persistent'));
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current[0]).toBe('persistent');
  });

  it('cancels the pending expiry on unmount', () => {
    const { result, unmount } = renderHook(useTransientMessage);
    act(() => result.current[1]('temporary', 5000));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('restarts the deadline when the same copy confirmation is shown again', () => {
    const { result } = renderHook(useTransientMessage);
    act(() => result.current[1]('copied', 3500));
    act(() => vi.advanceTimersByTime(3000));
    act(() => result.current[1]('copied', 3500));
    act(() => vi.advanceTimersByTime(500));
    expect(result.current[0]).toBe('copied');
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current[0]).toBeNull();
  });

  it('expires copy confirmation independently of a newer share message', () => {
    const { result, unmount } = renderHook(() => ({
      copy: useTransientMessage(),
      feedback: useTransientMessage(),
    }));
    act(() => {
      result.current.copy[1]('copied', 3500);
      result.current.feedback[1]('copy feedback', 3500);
    });
    act(() => vi.advanceTimersByTime(3000));
    act(() => result.current.feedback[1]('share feedback', 6000));
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.copy[0]).toBeNull();
    expect(result.current.feedback[0]).toBe('share feedback');
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
