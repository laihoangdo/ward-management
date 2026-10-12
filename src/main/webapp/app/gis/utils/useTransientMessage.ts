import { useCallback, useEffect, useRef, useState } from 'react';

export function useTransientMessage() {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const showMessage = useCallback(
    (next: string | null, duration?: number) => {
      clearTimer();
      setMessage(next);
      if (next !== null && duration !== undefined) {
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          setMessage(null);
        }, duration);
      }
    },
    [clearTimer],
  );

  return [message, showMessage] as const;
}
