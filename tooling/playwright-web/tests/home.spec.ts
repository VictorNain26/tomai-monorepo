import { expect, test } from '@playwright/test';

test('the page a visitor lands on renders in French at phone width, with one h1 and no horizontal scroll', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/connexion$/);

  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  const overflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflows).toBe(false);
});

test('the brand applies: paper background and Andika, loaded', async ({ page }) => {
  await page.goto('/connexion');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  const body = page.locator('body');
  await expect(body).toHaveCSS('background-color', 'rgb(246, 246, 243)');
  // WebKit serialises the computed family unquoted, Chromium quoted.
  await expect(body).toHaveCSS('font-family', /^"?Andika"?,/);
  const loaded = await page.evaluate(async () => {
    await document.fonts.ready;
    return document.fonts.check('16px "Andika"');
  });
  expect(loaded).toBe(true);
});
