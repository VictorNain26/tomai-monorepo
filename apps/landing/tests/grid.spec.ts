import { expect, test, type Page } from "@playwright/test";

const SECONDARY = ["/aide", "/faq", "/contact", "/cgu", "/confidentialite", "/mentions-legales"];
const PAGES = ["/", ...SECONDARY];
const WIDTHS = [375, 768, 1024, 1441];
const HEIGHT = 861;

interface Geometry {
  marginX: number;
  band: number;
}

function geometryFor(width: number): Geometry {
  return width >= 768 ? { marginX: 96, band: 96 } : { marginX: 56, band: 64 };
}

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => {
    const step = window.innerHeight / 2;
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
    window.scrollTo(0, 0);
  });
}

function inspectSheets(page: Page, geometry: Geometry) {
  return page.evaluate(({ marginX, band }) => {
    const near = (a: number, b: number) => Math.abs(a - b) <= 0.5;
    const problems: string[] = [];
    const sheets = [...document.querySelectorAll<HTMLElement>("[data-sheet]")];
    const nested = document.querySelectorAll("[data-sheet] [data-sheet]").length;

    for (const sheet of sheets) {
      const box = sheet.getBoundingClientRect();
      const layer = (name: string) => sheet.querySelector<HTMLElement>(`:scope > [data-sheet-${name}]`)?.getBoundingClientRect();
      const rules = layer("rules");
      const verticals = layer("verticals");
      const margin = layer("margin");
      if (!rules || !verticals || !margin) {
        problems.push("sheet without its three layers");
        continue;
      }
      if (Math.abs(box.left - Math.round(box.left)) > 0.01) problems.push(`sheet left not whole: ${box.left}`);
      if (!near(margin.left - box.left, marginX)) problems.push(`margin at ${margin.left - box.left}, expected ${marginX}`);
      if (!near(verticals.left, margin.left)) problems.push(`verticals start at ${verticals.left}, margin at ${margin.left}`);
      const rulesTop = sheet.hasAttribute("data-band") ? band : 0;
      if (!near(rules.top - box.top, rulesTop)) problems.push(`rules start at ${rules.top - box.top}, expected ${rulesTop}`);

      for (const el of sheet.querySelectorAll<HTMLElement>("p, h1, h2, h3, h4, li, a, button, input, dt, dd, label, blockquote")) {
        if (el.closest('[aria-hidden="true"]') || el.getClientRects().length === 0) continue;
        const left = el.getBoundingClientRect().left;
        if (left < margin.right - 0.5) problems.push(`<${el.tagName.toLowerCase()}> over the margin at ${left.toFixed(1)}`);
      }
    }
    return { sheets: sheets.length, nested, problems };
  }, geometry);
}

for (const path of PAGES) {
  for (const width of WIDTHS) {
    test(`${path} at ${width}px is drawn on one Seyès sheet`, async ({ page }) => {
      await page.setViewportSize({ width, height: HEIGHT });
      await page.goto(path);
      await settle(page);
      const { sheets, nested, problems } = await inspectSheets(page, geometryFor(width));
      expect(sheets, "not exactly one sheet on the page").toBe(1);
      expect(nested, "a sheet inside a sheet").toBe(0);
      expect(problems, problems.join("\n")).toEqual([]);
    });
  }
}

function inspectBounds(page: Page) {
  return page.evaluate(() => {
    const problems: string[] = [];
    if (document.documentElement.scrollWidth > window.innerWidth) {
      problems.push(`page scrolls sideways: ${document.documentElement.scrollWidth} > ${window.innerWidth}`);
    }
    if (document.querySelectorAll(".container .container").length > 0) problems.push("a container inside a container");
    for (const sheet of document.querySelectorAll<HTMLElement>("[data-sheet]")) {
      const box = sheet.getBoundingClientRect();
      for (const el of sheet.querySelectorAll<HTMLElement>("*")) {
        if (el.closest('[aria-hidden="true"]') || el.getClientRects().length === 0) continue;
        const rect = el.getBoundingClientRect();
        if (rect.left < box.left - 0.5 || rect.right > box.right + 0.5) {
          problems.push(`<${el.tagName.toLowerCase()} class="${el.className}"> spans ${rect.left.toFixed(1)}–${rect.right.toFixed(1)}, sheet ${box.left}–${box.right}`);
        }
      }
    }
    return problems;
  });
}

for (const path of PAGES) {
  for (const width of WIDTHS) {
    test(`${path} at ${width}px stays inside its sheet`, async ({ page }) => {
      await page.setViewportSize({ width, height: HEIGHT });
      await page.goto(path);
      await settle(page);
      const problems = await inspectBounds(page);
      expect(problems, problems.join("\n")).toEqual([]);
    });
  }
}
