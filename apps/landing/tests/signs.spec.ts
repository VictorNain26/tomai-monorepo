import { expect, test } from "@playwright/test";
import { PAGES } from "./support";

for (const path of PAGES) {
  test(`${path} keeps school signs rare`, async ({ page }) => {
    await page.goto(path);
    const problems = await page.evaluate(() => {
      const found: string[] = [];
      for (const mark of document.querySelectorAll("main mark")) {
        if (!mark.closest("h1, h2, h3")) found.push(`highlight outside a heading: ${mark.textContent}`);
        const style = getComputedStyle(mark);
        if (style.backgroundColor !== "rgba(0, 0, 0, 0)") {
          found.push(`highlight has an opaque background: ${mark.textContent} (${style.backgroundColor})`);
        }
        if (style.backgroundImage === "none") {
          found.push(`highlight has no gradient: ${mark.textContent}`);
        }
      }
      for (const heading of document.querySelectorAll("main :is(h1, h2, h3)")) {
        if (heading.querySelectorAll("mark").length > 1) found.push(`several highlights in: ${heading.textContent}`);
      }
      for (const section of document.querySelectorAll("main section")) {
        if (section.querySelectorAll(".font-hand").length > 1) {
          found.push(`several hand notes in: ${section.querySelector("h1, h2")?.textContent ?? section.id}`);
        }
      }
      return found;
    });
    expect(problems).toEqual([]);
  });
}
