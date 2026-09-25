import { expect, test } from "@playwright/test";
import { HEIGHT, settle } from "./support";

test("the hero keeps a square place for Tom beside the text on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1441, height: HEIGHT });
  await page.goto("/");
  await settle(page);
  const tom = await page.getByTestId("tom").boundingBox();
  const title = await page.locator("h1").boundingBox();
  expect(tom).not.toBeNull();
  expect(title).not.toBeNull();
  if (!tom || !title) return;
  expect(Math.abs(tom.width - tom.height)).toBeLessThanOrEqual(1);
  expect(tom.width).toBeGreaterThanOrEqual(240);
  expect(tom.x).toBeGreaterThanOrEqual(title.x + title.width);
});

test("the hero puts Tom's place under the sign-up form on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: HEIGHT });
  await page.goto("/");
  await settle(page);
  const tom = await page.getByTestId("tom").boundingBox();
  const form = await page.locator("section").first().locator("form").boundingBox();
  expect(tom).not.toBeNull();
  expect(form).not.toBeNull();
  if (!tom || !form) return;
  expect(Math.abs(tom.width - tom.height)).toBeLessThanOrEqual(1);
  expect(tom.y).toBeGreaterThanOrEqual(form.y + form.height);
});
