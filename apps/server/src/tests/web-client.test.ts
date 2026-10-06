/**
 * The web client served on the API's origin: its files, the SPA fallback after the API routes,
 * the cache headers, compression and revalidation, and the CSP.
 */

import { afterAll, describe, expect, it, mock } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import type { AppEnv } from '../platform/http/context';
import { createMockLogger } from './_helpers/mock-logger';

mock.module('../platform/observability/logger', () => ({ logger: createMockLogger() }));

const { handleNotFound } = await import('../platform/http/error-handler');
const { securityHeaders } = await import('../platform/http/security-headers');
const { webClient } = await import('../platform/http/web-client');

const root = mkdtempSync(join(tmpdir(), 'web-client-'));
writeFileSync(join(root, 'secret.txt'), 'outside the build');
const dist = join(root, 'dist');
mkdirSync(join(dist, 'assets'), { recursive: true });
writeFileSync(join(dist, 'index.html'), '<!doctype html><title>Tom</title>');
writeFileSync(join(dist, 'sw.js'), 'self.addEventListener("fetch", () => {});');
writeFileSync(join(dist, 'assets', 'index-B3q68diI.js'), 'console.log("app");');
// Above compress()'s 1 KiB threshold.
const BUNDLE = `console.log("${'tom'.repeat(1000)}");`;
writeFileSync(join(dist, 'assets', 'vendor-Dk2pQ9xa.js'), BUNDLE);
afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

// Composed as in app.ts: security headers first, API routes, then the web client.
const app = new Hono<AppEnv>().use(securityHeaders({ development: false })).get('/api/ping', (c) => c.json({ ok: true }));
app.notFound(handleNotFound);
app.route('/', webClient(dist));

const get = (path: string, init?: RequestInit) => app.request(path, init);

const INDEX = '<!doctype html><title>Tom</title>';
const IMMUTABLE = 'public, max-age=31536000, immutable';

describe('web client — files', () => {
  it('serves index.html at /, revalidated on every load', async () => {
    const res = await get('/');
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
  it('hands any other path to index.html, for the client router', async () => {
    const res = await get('/parent/enfants/42');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-cache');
    expect(await res.text()).toBe(INDEX);
  });

  it('leaves an API route to the API', async () => {
    const res = await get('/api/ping');
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get('cache-control')).toBeNull();
  });

  it.each(['/api/nope', '/api', '/api/chat/sessions/unknown'])('keeps the unknown API route %s a JSON 404', async (path) => {
    const res = await get(path);
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toStartWith('application/json');
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('NOT_FOUND');
  });

  it.each(['/assets/index-gone.js', '/robots.txt', '/apple-touch-icon-precomposed.png', '/old/sw.js'])(
    'answers the missing file %s with a 404, not with the page',
    async (path) => {
      const res = await get(path);
      expect(res.status).toBe(404);
      expect(res.headers.get('content-type')).toStartWith('application/json');
    },
  );

  it('serves nothing outside the build', async () => {
    const res = await get('/%2e%2e/secret.txt');
    expect(await res.text()).not.toContain('outside the build');
  });

  it('only answers reads', async () => {
    const res = await get('/parent', { method: 'POST' });
    expect(res.status).toBe(404);
  });
});

describe('web client — compression and revalidation', () => {
  it('compresses a file the browser accepts gzipped, and weakens its ETag', async () => {
    const res = await get('/assets/vendor-Dk2pQ9xa.js', { headers: { 'Accept-Encoding': 'gzip' } });
    expect(res.headers.get('content-encoding')).toBe('gzip');
    expect(res.headers.get('vary')).toContain('Accept-Encoding');
    expect(res.headers.get('etag')).toStartWith('W/"');
    expect(new TextDecoder().decode(Bun.gunzipSync(new Uint8Array(await res.arrayBuffer())))).toBe(BUNDLE);
  });

  it('sends the file as is to a browser that accepts no encoding', async () => {
    const res = await get('/assets/vendor-Dk2pQ9xa.js');
    expect(res.headers.get('content-encoding')).toBeNull();
    expect(await res.text()).toBe(BUNDLE);
  });

  it('answers a revalidation of an unchanged page with a 304 that keeps its cache policy', async () => {
    const tag = (await get('/')).headers.get('etag');
    expect(tag).toStartWith('"');

    const res = await get('/parent', { headers: { 'If-None-Match': tag ?? '' } });
    expect(res.status).toBe(304);
    expect(res.headers.get('cache-control')).toBe('no-cache');
    expect(await res.text()).toBe('');
  });

  it('revalidates a gzipped file against its weak ETag', async () => {
    const headers = { 'Accept-Encoding': 'gzip' };
    const tag = (await get('/assets/vendor-Dk2pQ9xa.js', { headers })).headers.get('etag') ?? '';

    const res = await get('/assets/vendor-Dk2pQ9xa.js', { headers: { ...headers, 'If-None-Match': tag } });
    expect(res.status).toBe(304);
  });
});

describe('security headers', () => {
  it('sets a CSP that allows this origin only, on pages as on the API', async () => {
    const csp = "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'";
    expect((await get('/')).headers.get('content-security-policy')).toBe(csp);
    expect((await get('/api/ping')).headers.get('content-security-policy')).toBe(csp);
  });

  it('keeps resources and the browsing context to this origin', async () => {
    const res = await get('/');
    expect(res.headers.get('cross-origin-resource-policy')).toBe('same-origin');
    expect(res.headers.get('cross-origin-opener-policy')).toBe('same-origin');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('strict-transport-security')).toBe('max-age=31536000; includeSubDomains');
  });

  describe('in development', () => {
    const dev = new Hono()
      .use(securityHeaders({ development: true }))
      .get('/api/auth/reference', (c) => c.html('<script>Scalar</script>'))
      .get('*', (c) => c.text('ok'));

    it('leaves out HSTS, so http://localhost keeps working', async () => {
      const res = await dev.request('/');
      expect(res.headers.get('strict-transport-security')).toBeNull();
      expect(res.headers.get('content-security-policy')).toStartWith("default-src 'self'");
    });

    it('lets the API reference load Scalar, and that page only', async () => {
      expect((await dev.request('/api/auth/reference')).headers.get('content-security-policy')).toBeNull();
      expect((await dev.request('/api/auth/sign-in/email')).headers.get('content-security-policy')).not.toBeNull();
    });
  });
});
