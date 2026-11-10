import { test, expect } from '../fixtures';

for (const endpoint of ['/api/account', '/api/households', '/api/residents', '/api/rbac/me']) {
  test(`API-SEC-001 @smoke anonymous ${endpoint} rejects record access`, async ({ request }) => {
    const response = await request.get(endpoint, { headers: { Accept: 'application/json' }, maxRedirects: 0 });
    expect(response.status()).toBe(401);
    expect(response.headers().location).toBeUndefined();
    // Security filters may send an empty 401 before MVC problem handling runs.
    const text = await response.text();
    if (text.trim()) {
      expect(response.headers()['content-type']).toContain('json');
      const body = JSON.parse(text);
      expect(body.status).toBe(401);
      expect(Array.isArray(body)).toBe(false);
      expect(body).not.toHaveProperty('content');
      expect(body).not.toHaveProperty('login');
      expect(body).not.toHaveProperty('role');
    }
  });
}
