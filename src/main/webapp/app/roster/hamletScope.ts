import axios from 'axios';

/** Hamlet the officer works on, shared by the roster, resident photos and subjects screens (server re-checks scope). */
export const HAMLET_STORAGE_KEY = 'roster_hamlet_v2';
/** `hamletId` value for every hamlet the user may open: all hamlets (super admin) or the commune (commune chief). */
export const ALL_HAMLETS = 'all';
const SCOPED_PREFIXES = ['/api/roster', '/api/subjects', '/api/facilities'];

type Saved = { user: string; value: string };

let saved: Saved | null = null;
try {
  const raw = window.sessionStorage.getItem(HAMLET_STORAGE_KEY);
  const parsed = raw ? (JSON.parse(raw) as Saved) : null;
  if (parsed && typeof parsed.user === 'string' && (parsed.value === ALL_HAMLETS || /^\d+$/.test(parsed.value))) saved = parsed;
  // The v1 key stored a bare id with no owner, so it leaked from one account to the next in the same tab.
  window.sessionStorage.removeItem('roster_hamlet_v1');
} catch {
  /* session storage may be unavailable; the server default applies */
}

let active = '';
let boundUser = '';

export const activeHamlet = () => active;
export const isAllHamlets = () => active === ALL_HAMLETS;

/**
 * Sets the hamlet view for the signed-in user. A choice remembered in this tab is kept only for the account that made it;
 * otherwise the default by role applies: the super admin and a commune chief with assigned hamlets see every hamlet they
 * may open, other officers get the server default (their assigned hamlet). Idempotent, so the host can call it while
 * rendering, before any scoped request of a child screen goes out.
 */
export function bindHamletScope(user: { login?: string; id?: string; username?: string; role?: string; hamletIds?: number[] }) {
  const key = user.login || user.username || user.id || '';
  if (!key || key === boundUser) return;
  boundUser = key;
  if (saved && saved.user === key) {
    active = saved.value;
    return;
  }
  saved = null;
  try {
    window.sessionStorage.removeItem(HAMLET_STORAGE_KEY);
  } catch {
    /* nothing remembered */
  }
  const commune = user.role === 'superadmin' || (user.role === 'admin' && (user.hamletIds?.length ?? 0) > 0);
  active = commune ? ALL_HAMLETS : '';
}

/** Changes the hamlet for later requests; {@code persist} also remembers it for this browser tab and this account. */
export function setActiveHamlet(value: string, persist = true) {
  active = value;
  if (!persist) return;
  try {
    if (!boundUser) window.sessionStorage.removeItem(HAMLET_STORAGE_KEY);
    else window.sessionStorage.setItem(HAMLET_STORAGE_KEY, JSON.stringify({ user: boundUser, value }));
  } catch {
    /* the selection still applies for this page view */
  }
}

// Every scoped request carries the selected hamlet; registered once, whichever screen loads first. A request that names
// its own hamlet (the map record of a household in another hamlet) keeps it.
axios.interceptors?.request.use(config => {
  const url = config.url;
  if (active && typeof url === 'string' && SCOPED_PREFIXES.some(prefix => url.startsWith(prefix)) && config.params?.hamletId == null) {
    config.params = { ...config.params, hamletId: active };
  }
  return config;
});
