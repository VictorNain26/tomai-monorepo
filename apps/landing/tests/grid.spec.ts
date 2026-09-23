import { expect, test, type Page } from "@playwright/test";

const PAGES = ["/", "/aide", "/contact", "/cgu", "/confidentialite", "/mentions-legales"];
const WIDTHS = [375, 768, 1024, 1260, 1440];
const HEIGHT = 900;

interface Grid {
  rule: number;
  cell: number;
  sheet: number;
}

interface Measure {
  checked: number;
  problems: string[];
}

const DEFAULT_GRID: Grid = { rule: 8, cell: 32, sheet: 1248 };

function measure(page: Page, grid: Grid): Promise<Measure> {
  return page.evaluate(({ rule, cell, sheet }) => {
    const TEXT = "p, h1, h2, h3, h4, h5, h6, dt, dd, blockquote, .legal-copy li";
    const offGrid = (value: number, step: number) => {
      const rest = ((value % step) + step) % step;
      return Math.min(rest, step - rest) > 1;
    };
    const problems: string[] = [];
    let checked = 0;

    for (const section of document.querySelectorAll<HTMLElement>(".bg-seyes")) {
      const box = section.getBoundingClientRect();
      const sheetX = Math.max(0, (section.clientWidth - sheet) / 2);
      const marginLeft = parseFloat(getComputedStyle(section, "::after").left);
      if (offGrid(marginLeft - sheetX, cell)) {
        problems.push(`margin off vertical: left=${marginLeft} sheetX=${sheetX} width=${section.clientWidth}`);
      }

      for (const el of section.querySelectorAll<HTMLElement>(TEXT)) {
        const text = el.textContent?.trim() ?? "";
        if (!text || el.closest('[aria-hidden="true"]') || el.getClientRects().length === 0) continue;
        checked++;

        // A margin note is tilted on purpose: measure the line box it is laid out on, before the tilt.
        // The reduced-motion rule turns any style change into a 0.01ms transition: disable it to read the result now.
        const tilt = el.style.rotate;
        el.style.transition = "none";
        el.style.rotate = "none";
        const probe = document.createElement("span");
        probe.style.cssText = "display:inline-block;width:0;height:0";
        el.prepend(probe);
        const baseline = probe.getBoundingClientRect().top - box.top;
        probe.remove();
        el.style.rotate = tilt;
        el.style.transition = "";

        const excerpt = text.slice(0, 40);
        if (offGrid(baseline, rule)) {
          problems.push(`baseline off rule: <${el.tagName.toLowerCase()}> "${excerpt}" y=${baseline.toFixed(2)}`);
        }
        const left = el.getBoundingClientRect().left;
        if (left < box.left + marginLeft + 2) {
          problems.push(`text over margin: <${el.tagName.toLowerCase()}> "${excerpt}" left=${left.toFixed(2)}`);
        }
      }
    }
    return { checked, problems };
  }, grid);
}

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => {
    const step = window.innerHeight / 2;
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      for (let frame = 0; frame < 2; frame++) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    }
    window.scrollTo(0, 0);
  });
  await page.waitForFunction(() =>
    [...document.querySelectorAll<HTMLElement>("[style*=transform]")].every((el) => el.style.transform === "none"),
  );
}

async function expectOnGrid(page: Page, grid: Grid) {
  const { checked, problems } = await measure(page, grid);
  expect(checked, "no text element measured").toBeGreaterThan(0);
  expect(problems, problems.join("\n")).toEqual([]);
}

for (const path of PAGES) {
  for (const width of WIDTHS) {
    test(`${path} at ${width}px sits on the Seyès grid`, async ({ page }) => {
      await page.setViewportSize({ width, height: HEIGHT });
      await page.goto(path);
      await settle(page);
      await expectOnGrid(page, DEFAULT_GRID);
    });
  }

  test(`${path} at 1024px with a 20px root font sits on the scaled grid`, async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: HEIGHT });
    await page.goto(path);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "20px";
    });
    await settle(page);
    await expectOnGrid(page, { rule: 10, cell: 40, sheet: 1560 });
  });
}
