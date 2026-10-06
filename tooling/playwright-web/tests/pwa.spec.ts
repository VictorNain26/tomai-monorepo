import { expect, test } from '@playwright/test';

interface Manifest {
  name: string;
  short_name: string;
  lang: string;
  start_url: string;
  display: string;
  background_color: string;
  theme_color: string;
  icons: { src: string; sizes: string; type: string }[];
}

test('the manifest makes the app installable, in the colors of the page', async ({ page, request }) => {
  await page.goto('/');

  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).not.toBeNull();
  const manifest = (await (await request.get(href ?? '')).json()) as Manifest;
  expect(manifest).toMatchObject({ name: 'Tom', short_name: 'Tom', lang: 'fr', start_url: '/', display: 'standalone' });
  expect(manifest.icons.map((icon) => icon.sizes).sort()).toEqual(['192x192', '512x512']);
  for (const icon of manifest.icons) {
    const response = await request.get(icon.src);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toBe(icon.type);
  }

  // The manifest can't read the tokens: its colors must stay those the page computes.
  const pageBackground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const toRgb = (color: string) =>
    page.evaluate((value) => {
      const probe = document.createElement('div');
      probe.style.color = value;
      document.body.append(probe);
      return getComputedStyle(probe).color;
    }, color);
  expect(await toRgb(manifest.background_color)).toBe(pageBackground);
  expect(await toRgb(manifest.theme_color)).toBe(pageBackground);
});

test('the service worker takes the app, and never an /api navigation', async ({ page }) => {
  await page.goto('/');

  const scriptURL = await page.evaluate(async () => (await navigator.serviceWorker.ready).active?.scriptURL);
  expect(scriptURL).toMatch(/\/sw\.js$/);
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

  const route = await page.goto('/une/route/du/client');
  expect(route?.fromServiceWorker()).toBe(true);

  // The route stands in for the server, so that the answer is known. page.route never sees
  // a request the service worker answered itself.
  await page.route('/api/**', (request) => request.fulfill({ status: 200, contentType: 'text/plain', body: 'API' }));
  const api = await page.goto('/api/auth/callback/google');
  expect(api?.fromServiceWorker()).toBe(false);
  expect(await api?.text()).toBe('API');
});
