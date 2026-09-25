import { expect, test } from "@playwright/test";
import { PAGES } from "./support";

for (const path of PAGES) {
  test(`${path} sets every title in weight 800`, async ({ page }) => {
    await page.goto(path);
    const light = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("main :is(h1, h2, h3)")]
        .filter((el) => getComputedStyle(el).fontWeight !== "800")
        .map((el) => `${el.tagName} ${getComputedStyle(el).fontWeight} ${el.textContent?.trim().slice(0, 30)}`),
    );
    expect(light).toEqual([]);
  });
}
