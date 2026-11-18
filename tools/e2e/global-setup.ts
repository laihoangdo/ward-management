import { request, type FullConfig } from '@playwright/test';

export default async function readiness(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL;
  const client = await request.newContext({ baseURL, timeout: 10_000 });
  try {
    const response = await client.get('/management/health');
    if (!response.ok()) throw new Error(`health returned HTTP ${response.status()}`);
    const health = await response.json();
    if (health.status !== 'UP') throw new Error('health JSON status is not UP');
  } catch {
    throw new Error(`E2E readiness failed at ${baseURL}. Start an isolated backend with PostgreSQL and OIDC; no journey has passed.`);
  } finally {
    await client.dispose();
  }
}
