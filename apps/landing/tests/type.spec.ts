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

test("/ gives every section title one size and every card title text-xl", async ({ page }) => {
  await page.setViewportSize({ width: 1441, height: 900 });
  await page.goto("/");
  const sizes = await page.evaluate(() => ({
    h2: [...new Set([...document.querySelectorAll("main h2")].map((el) => getComputedStyle(el).fontSize))],
    h3: [...new Set([...document.querySelectorAll("main h3")].map((el) => getComputedStyle(el).fontSize))],
  }));
  expect(sizes.h2).toHaveLength(1);
  expect(sizes.h3).toEqual(["20px"]);
});
