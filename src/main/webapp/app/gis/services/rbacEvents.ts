import axios from 'axios';

export interface RbacInvalidation {
  type: 'change' | 'resync';
  topics: string[];
  force?: boolean;
  version?: number;
}
const listeners = new Set<(event: RbacInvalidation) => void>();
let source: EventSource | null = null;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let watchdog: ReturnType<typeof setTimeout> | undefined;
let delay = 1000;
let disconnected = false;
let lastRevision: string | undefined;
let lastAccessRevision: string | undefined;
const emit = (event: RbacInvalidation) => [...listeners].forEach(listener => listener(event));
const resync = (force = false, topics: string[] = []) => emit({ type: 'resync', topics, force });

function clearTimers() {
  clearTimeout(retryTimer);
  clearTimeout(watchdog);
  retryTimer = undefined;
  watchdog = undefined;
}
function connect() {
  if (!listeners.size || source || typeof EventSource === 'undefined') return;
  const current = new EventSource(axios.getUri({ url: '/api/rbac/events' }), { withCredentials: true });
  source = current;
  const failed = () => {
    if (source !== current) return;
    current.close();
    source = null;
    clearTimers();
    disconnected = true;
    if (listeners.size) {
      retryTimer = setTimeout(connect, delay + Math.floor(Math.random() * 500));
      delay = Math.min(60000, delay * 2);
    }
  };
  const alive = () => {
    clearTimeout(watchdog);
    watchdog = setTimeout(failed, 65000);
  };
  alive();
  current.addEventListener('ready', event => {
    if (source !== current) return;
    alive();
    delay = 1000;
    let revision: string | undefined, accessRevision: string | undefined;
    try {
      const data = JSON.parse((event as MessageEvent<string>).data);
      revision = typeof data.revision === 'string' ? data.revision : undefined;
      accessRevision = typeof data.accessRevision === 'string' ? data.accessRevision : undefined;
    } catch {
      /* A missing revision requires a conservative resync. */
    }
    const force = lastRevision === undefined || (disconnected && (!accessRevision || accessRevision !== lastAccessRevision));
    const unchanged = disconnected && revision && revision === lastRevision;
    lastRevision = revision;
    lastAccessRevision = accessRevision;
    disconnected = false;
    resync(force, unchanged ? ['me'] : []);
  });
  current.addEventListener('ping', () => {
    if (source === current) alive();
  });
  current.addEventListener('change', event => {
    if (source !== current) return;
    alive();
    try {
      const data = JSON.parse((event as MessageEvent<string>).data);
      if (!Array.isArray(data.topics) || !data.topics.every(topic => typeof topic === 'string')) throw Error('Invalid notification');
      if (typeof data.revision === 'string') lastRevision = data.revision;
      if (typeof data.accessRevision === 'string') lastAccessRevision = data.accessRevision;
      emit({ type: 'change', topics: data.topics, force: data.force === true, version: data.version });
    } catch {
      resync(true);
    }
  });
  current.onerror = failed;
}
function visible() {
  if (document.visibilityState === 'hidden') return;
  resync(false, ['me']);
  if (!source) {
    clearTimeout(retryTimer);
    retryTimer = undefined;
    connect();
  }
}
function online() {
  visible();
}

/** One SSE stream for all consumers in this tab; no periodic GET for data or permissions. */
export function subscribeRbacEvents(listener: (event: RbacInvalidation) => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('online', online);
    connect();
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      source?.close();
      source = null;
      clearTimers();
      delay = 1000;
      disconnected = false;
      lastRevision = undefined;
      lastAccessRevision = undefined;
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener('online', online);
    }
  };
}
/** Local successful writes still refresh their affected UI, even during SSE reconnect. */
export function invalidateRbac(topics: string[]) {
  emit({ type: 'change', topics });
}

export function resetRbacEventSession() {
  source?.close();
  source = null;
  clearTimers();
  delay = 1000;
  disconnected = false;
  lastRevision = undefined;
  lastAccessRevision = undefined;
  if (listeners.size) retryTimer = setTimeout(connect, 0);
}
