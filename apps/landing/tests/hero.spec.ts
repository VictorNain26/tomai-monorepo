import { expect, test } from "@playwright/test";
import { HEIGHT, settle, waitForHydration } from "./support";

test("the hero shows Tom beside the text on desktop", async ({ page }) => {
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
  const image = page.getByTestId("tom").locator("img");
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
});

test("the hero puts Tom under the text on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: HEIGHT });
  await page.goto("/");
  await settle(page);
  const tom = await page.getByTestId("tom").boundingBox();
  const signals = await page.locator("section").first().locator("ul").first().boundingBox();
  expect(tom).not.toBeNull();
  expect(signals).not.toBeNull();
  if (!tom || !signals) return;
  expect(Math.abs(tom.width - tom.height)).toBeLessThanOrEqual(1);
  expect(tom.y).toBeGreaterThanOrEqual(signals.y + signals.height);
});

test.describe("with motion allowed", () => {
  test.use({ reducedMotion: "no-preference" });

  test("Tom waves, then breathes in a loop in place of his picture", async ({ page }) => {
    await page.goto("/");
    const tom = page.getByTestId("tom");
    const breathing = tom.locator("video[loop]");
    await expect(breathing).toBeVisible({ timeout: 10_000 });
    await expect.poll(() => breathing.evaluate((video: HTMLVideoElement) => !video.paused)).toBe(true);
    await expect(tom.locator("img")).toBeHidden();
    await expect(tom.locator("video:not([loop])")).toBeHidden();
  });
});

test("Tom stays still under reduced motion", async ({ page }) => {
  await page.goto("/");
  await waitForHydration(page);
  const tom = page.getByTestId("tom");
  await expect(tom.locator("img")).toBeVisible();
  await expect(tom.locator("video")).toHaveCount(2);
  for (const video of await tom.locator("video").all()) {
    await expect(video).toBeHidden();
    expect(await video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
  }
});
