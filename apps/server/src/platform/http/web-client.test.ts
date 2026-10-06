/**
 * The web client served on the API's origin: its files, the fallback for navigations after the API
 * routes, the cache headers, precompressed files and revalidation, and the security headers.
 */

import { afterAll, describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import { securityHeaders } from './security-headers';
import { webClient } from './web-client';

const INDEX = '<!doctype html><title>Tom</title>';
const BUNDLE = 'console.log("vendor");';
const IMMUTABLE = 'public, max-age=31536000, immutable';

const root = mkdtempSync(join(tmpdir(), 'web-client-'));
writeFileSync(join(root, 'secret.txt'), 'outside the build');
const dist = join(root, 'dist');
mkdirSync(join(dist, 'assets'), { recursive: true });
writeFileSync(join(dist, 'index.html'), INDEX);
writeFileSync(join(dist, 'sw.js'), 'self.addEventListener("fetch", () => {});');
writeFileSync(join(dist, 'assets', 'index-B3q68diI.js'), 'console.log("app");');
writeFileSync(join(dist, 'assets', 'vendor-Dk2pQ9xa.js'), BUNDLE);
writeFileSync(join(dist, 'assets', 'vendor-Dk2pQ9xa.js.gz'), Bun.gzipSync(BUNDLE));
afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

// Composed as in the server's app.ts: security headers first, API routes, then the web client.
const app = new Hono().use(securityHeaders({ hsts: true })).get('/api/ping', (c) => c.json({ ok: true }));
app.notFound((c) => c.json({ error: { code: 'NOT_FOUND' } }, 404));
app.route('/', webClient(dist));

const get = (path: string, init?: RequestInit) => app.request(path, init);
// What a browser sends when it navigates to a page.
const navigate = (path: string, headers: Record<string, string> = {}) =>
  get(path, { headers: { Accept: 'text/html,application/xhtml+xml,*/*;q=0.8', ...headers } });

describe('web client — files', () => {
  it('serves index.html at /, revalidated on every load', async () => {
    const res = await navigate('/');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toStartWith('text/html');
    expect(res.headers.get('cache-control')).toBe('no-cache');
    expect(await res.text()).toBe(INDEX);
  });

  it('caches a hashed asset for a year, immutable', async () => {
    const res = await get('/assets/index-B3q68diI.js');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toStartWith('text/javascript');
    expect(res.headers.get('cache-control')).toBe(IMMUTABLE);
  });

  it('revalidates the service worker, whose name never changes', async () => {
    const res = await get('/sw.js');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-cache');
  });

  it('answers HEAD like GET, without a body', async () => {
    const res = await get('/', { method: 'HEAD' });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-cache');
    expect(await res.text()).toBe('');
  });
});

describe('web client — fallback', () => {
  it.each(['/parent/enfants/42', '/parent/enfants/lea.martin', '/assets/', '/assets/nope'])(
    'hands the navigation to %s to index.html, revalidated on every load',
    async (path) => {
      const res = await navigate(path);
      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toBe('no-cache');
      expect(await res.text()).toBe(INDEX);
    },
  );

  it('leaves an API route to the API', async () => {
    const res = await navigate('/api/ping');
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get('cache-control')).toBeNull();
  });

  it.each(['/api/nope', '/api', '/api/chat/sessions/unknown'])('keeps the unknown API route %s a JSON 404', async (path) => {
    const res = await navigate(path);
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toStartWith('application/json');
  });

  it.each(['/assets/index-gone.js', '/robots.txt', '/apple-touch-icon-precomposed.png', '/old/sw.js', '/parent'])(
    'answers a request for the missing file %s with a 404, not with the page',
    async (path) => {
      const res = await get(path, { headers: { Accept: '*/*' } });
      expect(res.status).toBe(404);
      expect(res.headers.get('content-type')).toStartWith('application/json');
    },
  );

  it('serves nothing outside the build', async () => {
    const res = await navigate('/%2e%2e/secret.txt');
    expect(await res.text()).not.toContain('outside the build');
  });

  it('only answers reads', async () => {
    const res = await get('/parent', { method: 'POST', headers: { Accept: 'text/html' } });
    expect(res.status).toBe(404);
  });
});

describe('web client — compression and revalidation', () => {
  it('serves the precompressed file to a browser that accepts gzip', async () => {
    const res = await get('/assets/vendor-Dk2pQ9xa.js', { headers: { 'Accept-Encoding': 'gzip, deflate, br' } });
    expect(res.headers.get('content-encoding')).toBe('gzip');
    expect(res.headers.get('content-type')).toStartWith('text/javascript');
    expect(res.headers.get('vary')).toContain('Accept-Encoding');
    expect(res.headers.get('cache-control')).toBe(IMMUTABLE);
    expect(new TextDecoder().decode(Bun.gunzipSync(new Uint8Array(await res.arrayBuffer())))).toBe(BUNDLE);
  });

  it('sends the file as is to a browser that accepts no encoding', async () => {
    const res = await get('/assets/vendor-Dk2pQ9xa.js');
    expect(res.headers.get('content-encoding')).toBeNull();
    expect(await res.text()).toBe(BUNDLE);
  });

  it('answers a revalidation of an unchanged page with a 304 that keeps its cache policy', async () => {
    const tag = (await navigate('/')).headers.get('etag');
    expect(tag).toStartWith('"');

    const res = await navigate('/parent', { 'If-None-Match': tag ?? '' });
    expect(res.status).toBe(304);
    expect(res.headers.get('cache-control')).toBe('no-cache');
    expect(await res.text()).toBe('');
  });

  it('spends no hash on a hashed asset, which is never revalidated', async () => {
    expect((await get('/assets/index-B3q68diI.js')).headers.get('etag')).toBeNull();
  });
});

describe('security headers', () => {
  it('sets a CSP that allows this origin only, on pages as on the API', async () => {
    const csp = "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'";
    expect((await navigate('/')).headers.get('content-security-policy')).toBe(csp);
    expect((await get('/api/ping')).headers.get('content-security-policy')).toBe(csp);
  });

  it('keeps resources and the browsing context to this origin', async () => {
    const res = await navigate('/');
    expect(res.headers.get('cross-origin-resource-policy')).toBe('same-origin');
    expect(res.headers.get('cross-origin-opener-policy')).toBe('same-origin');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('strict-transport-security')).toBe('max-age=31536000; includeSubDomains');
  });

  it('leaves out HSTS where the origin is http://localhost', async () => {
    const res = await new Hono()
      .use(securityHeaders({ hsts: false }))
      .get('/', (c) => c.text('ok'))
      .request('/');
    expect(res.headers.get('strict-transport-security')).toBeNull();
    expect(res.headers.get('content-security-policy')).toStartWith("default-src 'self'");
  });
});
