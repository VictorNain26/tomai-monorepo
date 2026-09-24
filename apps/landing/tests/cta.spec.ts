import { expect, test } from "@playwright/test";
import { HEIGHT, waitForHydration } from "./support";

test("the mobile CTA bar on /aide sends to the home waitlist", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: HEIGHT });
  await page.goto("/aide");
  await waitForHydration(page);
  await page.evaluate(() => window.scrollTo(0, 600));
  const link = page.locator("div.fixed.bottom-0.left-0.right-0.md\\:hidden a");
  await link.click();
  await expect(page).toHaveURL("/#waitlist");
  await expect(page.locator("#waitlist")).toBeInViewport();
});

test("the mobile CTA bar leaves the end of the footer readable", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: HEIGHT });
  await page.goto("/contact");
  await waitForHydration(page);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const bar = page.locator("div.fixed.bottom-0.left-0.right-0.md\\:hidden");
  await expect.poll(() => bar.evaluate((el) => Math.round(el.getBoundingClientRect().bottom))).toBe(HEIGHT);
  const barTop = await bar.evaluate((el) => el.getBoundingClientRect().top);
  const lastLineBottom = await page.locator("footer p").last().evaluate((el) => el.getBoundingClientRect().bottom);
  expect(lastLineBottom).toBeLessThanOrEqual(barTop);
});
