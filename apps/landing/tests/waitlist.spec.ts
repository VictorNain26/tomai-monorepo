import { expect, test } from "@playwright/test";
import { holdScripts, waitForHydration } from "./support";

const TYPED = "parent@exemple.fr";

for (const frame of [{ width: 1440, height: 900 }, { width: 375, height: 667 }]) {
  test(`/ at ${frame.width}px keeps what was typed before hydration`, async ({ page }) => {
    await page.setViewportSize(frame);
    const release = await holdScripts(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const input = page.locator("main input[type=email]").first();
    await input.click();
    await page.keyboard.type(TYPED);

    await release();
    await waitForHydration(page);
    await expect(input).toHaveValue(TYPED);
    await expect(input).toBeFocused();
  });
}

test("/ submits the address typed before hydration", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const release = await holdScripts(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const form = page.locator("main form").first();
  await form.locator("input[type=email]").click();
  await page.keyboard.type(TYPED);

  await release();
  await waitForHydration(page);

  const requestPromise = page.waitForRequest((r) => r.method() === "POST" && !!r.headers()["next-action"]);
  await form.getByRole("button").click();
  const request = await requestPromise;
  expect(request.postData()).toContain(TYPED);
});

test("/ validates an address typed before hydration", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const release = await holdScripts(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const form = page.locator("main form").first();
  await form.locator("input[type=email]").click();
  await page.keyboard.type("parent@");

  await release();
  await waitForHydration(page);
  await page.keyboard.press("Tab");
  await expect(form.getByRole("alert")).toHaveText("Adresse email invalide");
});
