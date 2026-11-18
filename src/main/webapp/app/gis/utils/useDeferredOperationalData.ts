import { useCallback, useEffect, useRef, useState } from 'react';
import { loadOperationalData } from './operationalData';

type Results = Awaited<ReturnType<typeof loadOperationalData>>;

/** Load the old complete datasets only when a consumer needs them; share an in-flight refresh. */
export function useDeferredOperationalData(
  needed: boolean,
  onResults: (results: Results) => unknown,
  onLoading: (loading: boolean) => void,
) {
  const [hasLoaded, setHasLoaded] = useState(false);
  const mountedRef = useRef(true);
  const requestRef = useRef<Promise<Results> | null>(null);
  const callbacksRef = useRef({ onResults, onLoading });
  callbacksRef.current = { onResults, onLoading };
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const load = useCallback(() => {
    if (requestRef.current) return requestRef.current;
    callbacksRef.current.onLoading(true);
    requestRef.current = loadOperationalData()
      .then(results => {
        if (mountedRef.current) {
          callbacksRef.current.onResults(results);
          setHasLoaded(true);
        }
        return results;
      })
      .finally(() => {
        requestRef.current = null;
        if (mountedRef.current) callbacksRef.current.onLoading(false);
      });
    return requestRef.current;
  }, []);
  useEffect(() => {
    if (needed && !hasLoaded) void load();
  }, [needed, hasLoaded, load]);
  return { hasLoaded, load };
}
