import { expect, test } from '@playwright/test';
import { PAGES } from './support';

for (const path of PAGES) {
  test(`${path} names its own URL as canonical`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new URL(path, 'https://tomia.fr').href);
  });
}
