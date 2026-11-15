import axios from 'axios';

/** Hamlet the officer works on, shared by the roster, resident photos and subjects screens (server re-checks scope). */
export const HAMLET_STORAGE_KEY = 'roster_hamlet_v1';
const SCOPED_PREFIXES = ['/api/roster', '/api/subjects'];

let active = '';
try {
  const saved = window.sessionStorage.getItem(HAMLET_STORAGE_KEY);
  if (saved && /^\d+$/.test(saved)) active = saved;
} catch {
  /* session storage may be unavailable; the server default applies */
}

export const activeHamlet = () => active;

/** Changes the hamlet for later requests; {@code persist} also remembers it for this browser tab. */
export function setActiveHamlet(value: string, persist = true) {
  active = value;
  if (!persist) return;
  try {
    window.sessionStorage.setItem(HAMLET_STORAGE_KEY, value);
  } catch {
    /* the selection still applies for this page view */
  }
}

// Every scoped request carries the selected hamlet; registered once, whichever screen loads first.
axios.interceptors?.request.use(config => {
  const url = config.url;
  if (active && typeof url === 'string' && SCOPED_PREFIXES.some(prefix => url.startsWith(prefix))) {
    config.params = { ...config.params, hamletId: active };
  }
  return config;
});
