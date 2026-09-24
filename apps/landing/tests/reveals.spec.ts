import { expect, test } from "@playwright/test";
import { hiddenReveals, settle } from "./support";

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("/ shows every revealed block", async ({ page }) => {
    await page.goto("/");
    expect(await page.locator("[data-reveal]").count()).toBeGreaterThan(0);
    expect(await hiddenReveals(page)).toEqual([]);
  });

  test("/ shows every word and every stroke", async ({ page }) => {
    await page.goto("/");
    const hidden = await page.evaluate(() => {
      const found: string[] = [];
      const walker = document.createTreeWalker(document.querySelector("main") ?? document.body, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent?.trim();
        for (let el = node.parentElement; text && el; el = el.parentElement) {
          if (getComputedStyle(el).opacity === "0") {
            found.push(text.slice(0, 40));
            break;
          }
        }
      }
      for (const path of document.querySelectorAll("main svg path")) {
        if (getComputedStyle(path).strokeDasharray !== "none") found.push(`undrawn path ${path.getAttribute("d")}`);
      }
      return found;
    });
    expect(hidden).toEqual([]);
  });

  test("/aide shows the FAQ answer that starts open", async ({ page }) => {
    await page.goto("/aide");
    const answer = page.locator("#faq-answer-0");
    await expect(answer).toBeVisible();
    expect((await answer.boundingBox())?.height).toBeGreaterThan(24);
  });
});

test.describe("with motion", () => {
  test.use({ reducedMotion: "no-preference" });

  for (const path of ["/aide", "/cgu"]) {
    test(`${path} loads without a layout shift`, async ({ page }) => {
      await page.addInitScript(() => {
        window.layoutShift = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) window.layoutShift += (entry as PerformanceEntry & { value: number }).value;
        }).observe({ type: "layout-shift", buffered: true });
      });
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      await expect
        .poll(() =>
          page.evaluate(() =>
            [...document.querySelectorAll<HTMLElement>("[data-reveal]")].every(
              (el) => getComputedStyle(el).opacity === "1" && getComputedStyle(el).transform === "none",
            ),
          ),
        )
        .toBe(true);
      expect(await page.evaluate(() => window.layoutShift)).toBeLessThan(0.001);
    });
  }
});

for (const path of ["/", "/cgu"]) {
  test(`${path} ends every reveal opaque and in place under reduced motion`, async ({ page }) => {
    await page.goto(path);
    await settle(page);
    await expect.poll(() => hiddenReveals(page)).toEqual([]);
  });
}
