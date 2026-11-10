/**
 * Client-side route of the sign-in redirect. It must be a router path: a protocol-relative
 * `//host/sign-in` is read by React Router as the path `/host/sign-in`, which was then stored as the
 * post-login destination and sent signed-in users to a URL the server refuses (HTTP 403).
 */
export const getLoginUrl = () => '/sign-in';
export const REDIRECT_URL = 'redirectURL';

/**
 * Accept only an in-app route: a single leading slash (no other origin like "//x" or "https://x"), not the
 * sign-in route itself, and no dot in the path — the server only serves the app for dot-free paths
 * (SpaWebFilter), so a dotted path such as an old "/sunnytech.cloud/sign-in" would be refused.
 */
export const safeRedirectPath = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string' || !/^\/(?![/\\])\S*$/.test(value)) return null;
  const path = value.split(/[?#]/)[0];
  return path.includes('.') || path.startsWith('/sign-in') ? null : value;
};
