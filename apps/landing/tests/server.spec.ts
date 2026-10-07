import { expect, test } from '@playwright/test';
import { HEIGHT, PAGES, settle } from './support';

const HEADERS = {
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

test('/home redirects permanently to /', async ({ request }) => {
  const response = await request.get('/home', { maxRedirects: 0 });
  expect(response.status()).toBe(308);
  expect(response.headers()['location']).toBe('/');
});

test.describe('with motion', () => {
  test.use({ reducedMotion: 'no-preference' });

  for (const path of PAGES) {
    test(`${path} loads everything its CSP allows, and nothing it refuses`, async ({ page }) => {
      await page.addInitScript(() => {
        window.cspViolations = [];
        document.addEventListener('securitypolicyviolation', (event) => {
          window.cspViolations.push(`${event.violatedDirective} ${event.blockedURI}`);
        });
      });
      await page.setViewportSize({ width: 1441, height: HEIGHT });
      await page.goto(path);
      await settle(page);
      expect(await page.evaluate(() => window.cspViolations)).toEqual([]);
    });
  }
});
