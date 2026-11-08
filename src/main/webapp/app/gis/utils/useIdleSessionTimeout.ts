import { useEffect, useRef, useState } from 'react';

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'mousemove'] as const;

/**
 * Human-inactivity logout. Background polling and SSE traffic never count as
 * activity: only real input events reset the timer, so an unattended console
 * is signed out even though the health poll keeps the HTTP session alive.
 */
export function useIdleSessionTimeout(onTimeout: () => void, options?: { warningMs?: number; timeoutMs?: number }) {
  // The server session expires at 15 minutes; warn before that and sign out first.
  const warningMs = options?.warningMs ?? 12 * 60_000;
  const timeoutMs = options?.timeoutMs ?? 14 * 60_000;
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const lastActivityRef = useRef<number>(0);
  const timedOutRef = useRef(false);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  useEffect(() => {
    lastActivityRef.current = Date.now();
    const handleActivity = () => {
      lastActivityRef.current = Date.now();
    };
    ACTIVITY_EVENTS.forEach(event => window.addEventListener(event, handleActivity, { passive: true }));
    const warningSeconds = Math.ceil((timeoutMs - warningMs) / 1000);
    const tick = window.setInterval(() => {
      const remaining = Math.ceil((timeoutMs - (Date.now() - lastActivityRef.current)) / 1000);
      if (remaining <= 0) {
        setSecondsLeft(0);
        if (!timedOutRef.current) {
          timedOutRef.current = true;
          onTimeoutRef.current();
        }
        return;
      }
      timedOutRef.current = false;
      setSecondsLeft(remaining <= warningSeconds ? remaining : null);
    }, 1000);
    return () => {
      ACTIVITY_EVENTS.forEach(event => window.removeEventListener(event, handleActivity));
      window.clearInterval(tick);
    };
  }, [timeoutMs, warningMs]);

  const extend = () => {
    lastActivityRef.current = Date.now();
    timedOutRef.current = false;
    setSecondsLeft(null);
  };
  return { secondsLeft, extend };
}
