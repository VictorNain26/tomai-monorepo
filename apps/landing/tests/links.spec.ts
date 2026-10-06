import { expect, test } from '@playwright/test';
import { PAGES } from './support';

for (const path of PAGES) {
  test(`${path} has no sign-up form and never mentions the waitlist`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('form')).toHaveCount(0);
    await expect(page.locator('a[href*="#waitlist"]')).toHaveCount(0);
    await expect(page.getByText(/liste d.attente/i)).toHaveCount(0);
  });
}
