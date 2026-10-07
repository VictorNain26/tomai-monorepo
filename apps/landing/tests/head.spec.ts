import { expect, test } from '@playwright/test';
import { PAGES } from './support';

for (const path of PAGES) {
  test(`${path} names its own URL as canonical`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new URL(path, 'https://tomia.fr').href);
  });
}

test('the Open Graph image every page names is served', async ({ page, request }) => {
  await page.goto('/');
  const image = new URL((await page.locator('meta[property="og:image"]').getAttribute('content')) ?? '');
  const response = await request.get(image.pathname);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toBe('image/png');
});
