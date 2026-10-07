import { expect, test, type Page } from '@playwright/test';

// The built web as the built server serves it (playwright.config.ts): its CSP, its fallback.

async function recordCspViolations(page: Page) {
  await page.addInitScript(() => {
    const violations: string[] = [];
    Object.assign(window, { cspViolations: violations });
    document.addEventListener('securitypolicyviolation', (event) => violations.push(`${event.violatedDirective} ${event.blockedURI}`));
  });
  return () => page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations);
}

test('the app runs under the CSP of the server without a single violation', async ({ page }) => {
  const violations = await recordCspViolations(page);

  const response = await page.goto('/');
  expect(response?.headers()['content-security-policy']).toContain("default-src 'self'");
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.evaluate(async () => navigator.serviceWorker.ready);

  expect(await violations()).toEqual([]);
});

test('the build ships its scripts precompressed, and the server sends them gzipped', async ({ request }) => {
  const html = await (await request.get('/')).text();
  const entry = /<script type="module" crossorigin src="([^"]+)"/.exec(html)?.[1] ?? '';

  const response = await request.get(entry, { headers: { 'Accept-Encoding': 'gzip' } });
  expect(response.headers()['content-encoding']).toBe('gzip');
  expect(response.headers()['cache-control']).toBe('public, max-age=31536000, immutable');
});

test('the check catches what the CSP blocks', async ({ page }) => {
  const violations = await recordCspViolations(page);
  await page.goto('/');

  await page.evaluate(() => {
    const script = document.createElement('script');
    script.textContent = 'void 0';
    document.head.append(script);
  });

  await expect.poll(violations).toEqual([expect.stringMatching(/^script-src-elem inline$/)]);
});

// An open tab still asks for the chunks of its own build, gone from the server. The router reloads
// the page once per missing chunk (lazyRouteComponent, autoCodeSplitting in vite.config.ts):
// https://tanstack.com/router/latest/docs/framework/react/api/router/lazyRouteComponentFunction
test.describe('after a deployment', () => {
  // The service worker would answer from its cache, which page.route never sees.
  test.use({ serviceWorkers: 'block' });

  // The chunk of the sign-in, where a visitor lands: a route's own chunk, the one the router loads
  // lazily, not a chunk the entry shares, whose loss would stop the whole app.
  async function failRouteChunk(page: Page, times: number) {
    let failed = 0;
    await page.route('/assets/connexion-*.js', async (route) => {
      if (failed >= times) return route.fallback();
      failed++;
      return route.fulfill({ status: 404, body: '' });
    });
    return () => failed;
  }

  test('a chunk gone after a deployment reloads the page onto the new build', async ({ page }) => {
    const failed = await failRouteChunk(page, 1);
    let loads = 0;
    page.on('load', () => loads++);

    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(failed()).toBe(1);
    expect(loads).toBe(2);
  });

  test('a chunk missing from the new build too shows the error instead of looping', async ({ page }) => {
    const failed = await failRouteChunk(page, Number.POSITIVE_INFINITY);
    let loads = 0;
    page.on('load', () => loads++);

    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Une erreur est survenue' })).toBeVisible();
    expect(failed()).toBe(2);
    expect(loads).toBe(2);
  });
});
