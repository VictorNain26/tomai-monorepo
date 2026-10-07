import { expect, test } from '@playwright/test';
import { addChild, guardian, pairedStudent } from '../guardian';

test('a guardian proposes the memory when adding the child, sees its state, and withdraws it', async ({ page }) => {
  await guardian(page, 'memoire');
  await addChild(page, 'Lou', { memory: true });
  await expect(page.getByText('Proposée : Lou répondra à sa prochaine visite.')).toBeVisible();

  await page.getByRole('button', { name: 'Retirer et effacer la mémoire' }).click();
  await expect(page.getByText('Pas proposée : Tom ne retient rien d’une séance à l’autre.')).toBeVisible();
  await page.getByRole('button', { name: 'Proposer la mémoire à Lou' }).click();
  await expect(page.getByText('Proposée : Lou répondra à sa prochaine visite.')).toBeVisible();
});

test('the child is asked on their home, accepts, sees what Tom keeps, then stops it', async ({ page, browser }, testInfo) => {
  await pairedStudent(page, browser, testInfo, 'Max', { memory: true });
  const offer = page.getByRole('region', { name: 'Tom peut retenir ce qui a résisté' });
  await expect(offer).toContainText('Il ne garde rien de ce que tu écris');
  await offer.getByRole('button', { name: 'D’accord' }).click();
  await expect(offer).toBeHidden();

  await page.getByRole('link', { name: 'Ce que Tom retient' }).click();
  await expect(page.getByRole('heading', { name: 'Ce que Tom retient' })).toBeVisible();
  await expect(page.getByText('Rien pour l’instant')).toBeVisible();

  await page.getByRole('button', { name: 'Arrêter la mémoire' }).click();
  await expect(page.getByRole('region', { name: 'Tom peut retenir ce qui a résisté' })).toBeVisible();
});

test('a child whose parent did not propose it is not asked', async ({ page, browser }, testInfo) => {
  await pairedStudent(page, browser, testInfo, 'Ana');
  await expect(page.getByRole('region', { name: 'Tom peut retenir ce qui a résisté' })).toBeHidden();
  await page.getByRole('link', { name: 'Ce que Tom retient' }).click();
  await expect(page.getByText('Tom ne retient rien d’une séance à l’autre.')).toBeVisible();
});
