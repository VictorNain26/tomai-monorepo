import { expect, test } from '@playwright/test';
import { HEIGHT, settle, waitForHydration } from './support';

test('the hero shows the sample session in the first screen, Tom beside it, on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1441, height: HEIGHT });
  await page.goto('/');
  await settle(page);
  const session = await page.getByRole('figure').first().boundingBox();
  const title = await page.locator('h1').boundingBox();
  const tom = page.getByTestId('tom');
  expect(session).not.toBeNull();
  expect(title).not.toBeNull();
  if (!session || !title) return;
  expect(session.x).toBeGreaterThanOrEqual(title.x + title.width);
  expect(session.y).toBeLessThan(HEIGHT);
  await expect(tom).toBeVisible();
  const image = tom.locator('img');
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
});

test('the hero puts the sample session under the text and leaves Tom out on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: HEIGHT });
  await page.goto('/');
  await settle(page);
  const session = await page.getByRole('figure').first().boundingBox();
  const signals = await page.locator('section').first().locator('ul').first().boundingBox();
  expect(session).not.toBeNull();
  expect(signals).not.toBeNull();
  if (!session || !signals) return;
  expect(session.y).toBeGreaterThanOrEqual(signals.y + signals.height);
  await expect(page.getByTestId('tom')).toBeHidden();
});

test.describe('on mobile with motion allowed', () => {
  test.use({ reducedMotion: 'no-preference' });

  test("Tom's clips are never downloaded", async ({ page }) => {
    const clips: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/tom/')) clips.push(request.url());
    });
    await page.setViewportSize({ width: 375, height: HEIGHT });
    await page.goto('/');
    await waitForHydration(page);
    await page.waitForLoadState('networkidle');
    expect(clips).toEqual([]);
  });
});

test.describe('with motion allowed', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('Tom waves, then breathes in a loop in place of his picture', async ({ page }) => {
    await page.goto('/');
    const tom = page.getByTestId('tom');
    const breathing = tom.locator('video[loop]');
    await expect(breathing).toBeVisible({ timeout: 10_000 });
    await expect.poll(() => breathing.evaluate((video: HTMLVideoElement) => !video.paused)).toBe(true);
    await expect(tom.locator('img')).toBeHidden();
    await expect(tom.locator('video:not([loop])')).toBeHidden();
  });
});

test('Tom stays still under reduced motion', async ({ page }) => {
  await page.goto('/');
  await waitForHydration(page);
  const tom = page.getByTestId('tom');
  await expect(tom.locator('img')).toBeVisible();
  await expect(tom.locator('video')).toHaveCount(2);
  for (const video of await tom.locator('video').all()) {
    await expect(video).toBeHidden();
    expect(await video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
  }
});
