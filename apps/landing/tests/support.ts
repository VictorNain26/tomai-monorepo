import type { Page } from "@playwright/test";

declare global {
  interface Window {
    layoutShift: number;
  }
}

const SECONDARY = ["/aide", "/faq", "/contact", "/cgu", "/confidentialite", "/mentions-legales"];
export const PAGES = ["/", ...SECONDARY];
export const WIDTHS = [375, 768, 1024, 1441];
export const HEIGHT = 861;

export async function waitForHydration(page: Page) {
  await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

export async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  // Reveals only listen once hydrated; a short page would otherwise be scrolled through before they can fire.
  await waitForHydration(page);
  await page.evaluate(async () => {
    const step = window.innerHeight / 2;
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
    window.scrollTo(0, 0);
  });
}

export function hiddenReveals(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("[data-reveal]")]
      .filter((el) => getComputedStyle(el).opacity !== "1" || getComputedStyle(el).transform !== "none")
      .map((el) => el.textContent?.trim().slice(0, 40) ?? ""),
  );
}
