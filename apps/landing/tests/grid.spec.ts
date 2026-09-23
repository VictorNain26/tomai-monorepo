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
    for (const container of document.querySelectorAll<HTMLElement>("[data-sheet] .container")) {
      const box = container.getBoundingClientRect();
      const style = getComputedStyle(container);
      const left = box.left + parseFloat(style.paddingLeft);
      const right = box.right - parseFloat(style.paddingRight);
      for (const el of container.querySelectorAll<HTMLElement>("*")) {
        if (el.closest('[aria-hidden="true"], .sr-only') || el.getClientRects().length === 0) continue;
        const rect = el.getBoundingClientRect();
        // 2 px of slack: a rotated margin note grows its box by a pixel or two.
        if (rect.left < left - 2 || rect.right > right + 2) {
          problems.push(`<${el.tagName.toLowerCase()} class="${el.className}"> spans ${rect.left.toFixed(1)}–${rect.right.toFixed(1)}, container text ${left}–${right}`);
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

function hiddenReveals(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("[data-reveal]")]
      .filter((el) => getComputedStyle(el).opacity !== "1" || getComputedStyle(el).transform !== "none")
      .map((el) => el.textContent?.trim().slice(0, 40) ?? ""),
  );
}

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  for (const path of ["/", "/cgu"]) {
    test(`${path} shows every revealed block`, async ({ page }) => {
      await page.goto(path);
      expect(await page.locator("[data-reveal]").count()).toBeGreaterThan(0);
      expect(await hiddenReveals(page)).toEqual([]);
    });
  }

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

test("/cgu at 1441px keeps legal lines within 85 characters", async ({ page }) => {
  await page.setViewportSize({ width: 1441, height: HEIGHT });
  await page.goto("/cgu");
  await settle(page);
  const longest = await page.evaluate(() => {
    let max = 0;
    const range = document.createRange();
    for (const p of document.querySelectorAll(".legal-copy p")) {
      const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
      let top: number | null = null;
      let count = 0;
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        for (let i = 0; i < (node.textContent ?? "").length; i++) {
          range.setStart(node, i);
          range.setEnd(node, i + 1);
          const rect = range.getClientRects()[0];
          if (!rect || rect.width === 0) continue;
          if (top !== null && Math.abs(rect.top - top) > 4) {
            max = Math.max(max, count);
            count = 0;
          }
          top = rect.top;
          count++;
        }
      }
      max = Math.max(max, count);
    }
    return max;
  });
  expect(longest).toBeLessThanOrEqual(85);
});

for (const width of [375, 1024]) {
  test(`header and page controls at ${width}px are at least 44px targets`, async ({ page }) => {
    await page.setViewportSize({ width, height: HEIGHT });
    for (const path of ["/", "/aide"]) {
      await page.goto(path);
      await settle(page);
      const small = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>("header a, header button, main a, main button, main input")]
          .filter((el) => el.getClientRects().length > 0 && !el.closest(".sr-only"))
          .filter((el) => !(el.tagName === "A" && getComputedStyle(el).display === "inline"))
          .map((el) => ({ text: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30), box: el.getBoundingClientRect() }))
          .filter(({ box }) => box.width < 44 || box.height < 44)
          .map(({ text, box }) => `${text} ${Math.round(box.width)}×${Math.round(box.height)}`),
      );
      expect(small, path).toEqual([]);
    }
  });
}

test("/aide at 375px keeps each FAQ question within three lines", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: HEIGHT });
  await page.goto("/aide");
  await settle(page);
  const tall = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("[id^=faq-question-] span")]
      .map((span) => ({ text: span.textContent ?? "", lines: Math.round(span.offsetHeight / parseFloat(getComputedStyle(span).lineHeight)) }))
      .filter(({ lines }) => lines > 3),
  );
  expect(tall).toEqual([]);
});

test("/ at 375px keeps 8px between a wrapped pricing label and its button edge", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: HEIGHT });
  await page.goto("/");
  await settle(page);
  const cramped = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("#pricing a")].flatMap((button) => {
      const range = document.createRange();
      range.selectNodeContents(button);
      const text = range.getBoundingClientRect();
      const box = button.getBoundingClientRect();
      const gap = Math.min(text.top - box.top, box.bottom - text.bottom);
      return gap < 7.5 ? [`${button.textContent?.trim()} ${gap.toFixed(1)}px`] : [];
    }),
  );
  expect(cramped).toEqual([]);
});

declare global {
  interface Window {
    layoutShift: number;
  }
}

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
      await page.waitForTimeout(1500);
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

function textOffCards(page: Page) {
  return page.evaluate(() => {
    const loose: string[] = [];
    const walker = document.createTreeWalker(document.querySelector("main") ?? document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.trim();
      const parent = node.parentElement;
      if (!text || !parent || parent.closest('[aria-hidden="true"], script, style, noscript')) continue;
      if (parent.getClientRects().length === 0) continue;
      if (!parent.closest("[data-fiche]")) loose.push(text.slice(0, 40));
    }
    return loose;
  });
}

for (const path of SECONDARY) {
  test(`${path} keeps its typed text on cards`, async ({ page }) => {
    await page.goto(path);
    await settle(page);
    expect(await textOffCards(page)).toEqual([]);
  });
}
