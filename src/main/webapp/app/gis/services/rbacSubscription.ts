import { RbacInvalidation, subscribeRbacEvents } from './rbacEvents';

/** Coalesce bursts and preserve one follow-up invalidation while a request is in flight. */
export function subscribeRbacResource<T>(
  topic: string,
  read: (signal: AbortSignal) => Promise<T>,
  onData: (data: T) => void,
  onError: (error: unknown) => void,
  onInvalidate?: () => void,
) {
  let active = true,
    loading = false,
    dirty = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;
  const schedule = () => {
    if (!active) return;
    dirty = true;
    if (loading || timer !== undefined) return;
    timer = setTimeout(() => {
      timer = undefined;
      if (!active) return;
      dirty = false;
      loading = true;
      controller = new AbortController();
      void read(controller.signal)
        .then(data => {
          if (active && !dirty) onData(data);
        })
        .catch(error => {
          if (active && !dirty) onError(error);
        })
        .finally(() => {
          loading = false;
          if (dirty && active) schedule();
        });
    }, 25);
  };
  const changed = (event: RbacInvalidation) => {
    if (event.type === 'resync' ? event.topics?.length > 0 && !event.topics.includes(topic) : !event.topics.includes(topic)) return;
    if (topic === 'me' && event.force) onInvalidate?.();
    schedule();
  };
  const stop = subscribeRbacEvents(changed);
  schedule();
  return () => {
    active = false;
    clearTimeout(timer);
    controller?.abort();
    stop();
  };
}
