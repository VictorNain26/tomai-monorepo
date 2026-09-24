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
