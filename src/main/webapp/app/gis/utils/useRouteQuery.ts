import { useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';

/** Router-backed state. Merge same-tick updates without losing sibling parameters. */
export function useRouteQuery() {
  const location = useLocation();
  const navigate = useNavigate();
  const pendingRef = useRef({ location, search: location.search, queued: false, replace: false });
  if (pendingRef.current.location !== location) pendingRef.current = { location, search: location.search, queued: false, replace: false };
  const updateQuery = useCallback(
    (values: Record<string, string | null>, replace = false) => {
      const current = pendingRef.current;
      const params = new URLSearchParams(current.search);
      Object.entries(values).forEach(([key, value]) => {
        if (value === null || value === '') params.delete(key);
        else params.set(key, value);
      });
      const search = params.toString();
      if (search === current.search.replace(/^\?/, '')) return;
      current.search = search ? `?${search}` : '';
      if (current.queued) {
        current.replace = current.replace && replace;
        return;
      }
      current.queued = true;
      current.replace = replace;
      queueMicrotask(() => {
        current.queued = false;
        if (pendingRef.current !== current || current.search === current.location.search) return;
        void navigate(
          { pathname: current.location.pathname, search: current.search, hash: current.location.hash },
          { replace: current.replace },
        );
      });
    },
    [navigate],
  );
  return { params: new URLSearchParams(location.search), updateQuery };
}

export const RECORD_QUERY_KEYS = {
  gisHousehold: null,
  legacyHousehold: null,
  household: null,
  resident: null,
  edit: null,
  collection: null,
  newHousehold: null,
};
