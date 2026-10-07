import { expect, test, type Page } from '@playwright/test';
import { HEIGHT, PAGES, settle, waitForHydration } from './support';

const HEADERS = {
  'strict-transport-security': 'max-age=63072000',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'content-security-policy': "frame-ancestors 'none'; object-src 'none'; base-uri 'none'",
};

for (const path of [...PAGES, '/cette-page-n-existe-pas']) {
  test(`${path} is served with the security headers`, async ({ request }) => {
    const response = await request.get(path);
    expect(response.headers()).toMatchObject(HEADERS);
  });
}

for (const [from, to] of [
  ['/home', '/'],
  ['/sitemap.xml', '/sitemap-index.xml'],
  ['/aide/', '/aide'],
  ['/faq/?q=1', '/faq?q=1'],
] as const) {
  test(`${from} redirects permanently to ${to}`, async ({ request }) => {
    const response = await request.get(from, { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    expect(response.headers()['location']).toBe(to);
  });
}

test('a trailing slash never redirects to another host', async ({ request }) => {
  for (const path of ['/%5Cevil.com/', '//evil.com/']) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(new URL(response.headers()['location'] ?? '/', 'http://localhost').host, path).toBe('localhost');
  }
});

test('a visitor on plain HTTP is sent to HTTPS, as the load balancer reports it', async ({ request }) => {
  const response = await request.get('/aide?x=1', { maxRedirects: 0, headers: { 'x-forwarded-proto': 'http' } });
  expect(response.status()).toBe(308);
  expect(response.headers()['location']).toMatch(/^https:\/\/[^/]+\/aide\?x=1$/);
});

for (const path of ['/aide.html', '/index', '/404']) {
  test(`${path}, a file of the build, is not a URL`, async ({ request }) => {
    expect((await request.get(path)).status()).toBe(404);
  });
}

test('a missing asset is a 404 no cache keeps', async ({ request }) => {
  const response = await request.get('/_astro/missing.js');
  expect(response.status()).toBe(404);
  expect(response.headers()['cache-control']).toBe('no-store');
});

test('the 404 page asks not to be indexed, where every page asks to be', async ({ page }) => {
  await page.goto('/cette-page-n-existe-pas');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  await page.goto('/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
});

test('an error other than 404 keeps the security headers', async ({ request }) => {
  const response = await request.post('/');
  expect(response.status()).toBe(405);
  expect(response.headers()).toMatchObject(HEADERS);
});

function recordCspViolations(page: Page) {
  return page.addInitScript(() => {
    window.cspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      window.cspViolations.push(`${event.violatedDirective} ${event.blockedURI}`);
    });
  });
}

test.describe('with motion', () => {
  test.use({ reducedMotion: 'no-preference' });

  for (const path of PAGES) {
    test(`${path} loads everything its CSP allows, and nothing it refuses`, async ({ page }) => {
      await recordCspViolations(page);
      await page.setViewportSize({ width: 1441, height: HEIGHT });
      await page.goto(path);
      await settle(page);
      expect(await page.evaluate(() => window.cspViolations)).toEqual([]);
    });
  }
});

test('the mobile menu opens with nothing refused by the CSP', async ({ page }) => {
  await recordCspViolations(page);
  await page.setViewportSize({ width: 375, height: HEIGHT });
  await page.goto('/');
  await waitForHydration(page);
  await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => window.cspViolations)).toEqual([]);
});
