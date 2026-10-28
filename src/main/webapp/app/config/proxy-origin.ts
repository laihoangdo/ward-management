/** Preserve the browser-facing origin across the Cloudflare -> Vite -> backend hops. */
export function proxyOrigin(request: { headers: Record<string, string | string[] | undefined>; socket?: unknown }) {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.split(',')[0].trim();
  const host = first(request.headers['x-forwarded-host']) || first(request.headers.host) || 'localhost:9000';
  const forwarded = first(request.headers['x-forwarded-proto']);
  const encrypted =
    typeof request.socket === 'object' && request.socket !== null && 'encrypted' in request.socket && request.socket.encrypted === true;
  const protocol = forwarded === 'https' || forwarded === 'http' ? forwarded : encrypted ? 'https' : 'http';
  const port = first(request.headers['x-forwarded-port']) || /:(\d+)$/.exec(host)?.[1] || (protocol === 'https' ? '443' : '80');
  return { host, protocol, port };
}
