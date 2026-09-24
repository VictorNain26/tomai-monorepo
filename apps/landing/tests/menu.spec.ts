import { expect, test } from "@playwright/test";
import { HEIGHT, waitForHydration } from "./support";

test("the mobile menu opens, lists the sections and closes on Escape", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: HEIGHT });
  await page.goto("/");
  await waitForHydration(page);
  const trigger = page.getByRole("button", { name: "Ouvrir le menu" });
  await trigger.click();
  const menu = page.getByRole("dialog");
  await expect(menu).toBeVisible();
  const nav = menu.getByRole("navigation", { name: "Principale" });
  for (const name of ["Comment ça marche", "Parents", "Tarifs"]) {
    await expect(nav.getByRole("link", { name })).toBeVisible();
  }
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("the desktop header shows its links and hides the menu button", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: HEIGHT });
  await page.goto("/");
  const header = page.getByRole("banner");
  for (const name of ["Comment ça marche", "Parents", "Tarifs", "S'inscrire"]) {
    await expect(header.getByRole("link", { name })).toBeVisible();
  }
  await expect(header.getByRole("button", { name: "Ouvrir le menu" })).toBeHidden();
});
