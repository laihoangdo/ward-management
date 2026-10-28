import { describe, expect, it } from 'vitest';
import { proxyOrigin } from './proxy-origin';

describe('Development proxy browser origin', () => {
  it('keeps the HTTPS tunnel origin for every proxied authentication/API request', () => {
    expect(proxyOrigin({ headers: { host: 'example.trycloudflare.com', 'x-forwarded-proto': 'https' } })).toEqual({
      host: 'example.trycloudflare.com',
      protocol: 'https',
      port: '443',
    });
  });
  it('keeps local HTTP and its port instead of forcing HTTPS', () => {
    expect(proxyOrigin({ headers: { host: 'localhost:9000' } })).toEqual({ host: 'localhost:9000', protocol: 'http', port: '9000' });
  });
  it('handles forwarded header chains consistently', () => {
    expect(
      proxyOrigin({
        headers: {
          host: 'localhost:9000',
          'x-forwarded-host': 'example.trycloudflare.com, localhost:9000',
          'x-forwarded-proto': 'https,http',
        },
      }),
    ).toEqual({ host: 'example.trycloudflare.com', protocol: 'https', port: '443' });
  });
});
