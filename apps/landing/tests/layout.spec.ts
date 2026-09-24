import { expect, test, type Page } from "@playwright/test";
import { HEIGHT, PAGES, settle, WIDTHS } from "./support";

function inspectBounds(page: Page) {
  return page.evaluate(() => {
    const problems: string[] = [];
    if (document.documentElement.scrollWidth > window.innerWidth) {
      problems.push(`page scrolls sideways: ${document.documentElement.scrollWidth} > ${window.innerWidth}`);
    }
    if (document.querySelectorAll(".container .container").length > 0) problems.push("a container inside a container");
    for (const container of document.querySelectorAll<HTMLElement>(".container")) {
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
    test(`${path} at ${width}px never scrolls sideways`, async ({ page }) => {
      await page.setViewportSize({ width, height: HEIGHT });
      await page.goto(path);
      await settle(page);
      const problems = await inspectBounds(page);
      expect(problems, problems.join("\n")).toEqual([]);
    });
  }
}

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
