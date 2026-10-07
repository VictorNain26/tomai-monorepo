import { devices, expect, test, type Browser, type Page, type TestInfo } from '@playwright/test';
import { guardian } from '../guardian';

// The child's own phone, of the same kind as the guardian's.
const childPhone = (browser: Browser, testInfo: TestInfo) =>
  browser.newContext({ ...devices[testInfo.project.name === 'iphone' ? 'iPhone 15' : 'Pixel 7'] });

async function addChild(page: Page, name: string) {
  await page.getByLabel('Son prénom', { exact: true }).fill(name);
  await page.getByLabel('Sa classe', { exact: true }).selectOption({ label: 'Cinquième' });
  await page.getByLabel('Son mois de naissance').fill('2014-03');
  await page.getByRole('button', { name: 'Ajouter' }).click();
  await page.getByRole('link', { name: new RegExp(`^${name}`) }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

test('a guardian adds a child, changes their class, then deletes their account', async ({ page }) => {
  await guardian(page, 'foyer');
  await expect(page.getByText('Ajoutez votre enfant')).toBeVisible();
  await addChild(page, 'Léa');

  await page.getByLabel('Sa classe', { exact: true }).selectOption({ label: 'Quatrième' });
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('status')).toHaveText('Enregistré.');

  await page.getByRole('button', { name: 'Supprimer le compte de Léa' }).click();
  await expect(page.getByRole('alert')).toContainText('C’est définitif');
  await page.getByRole('button', { name: 'Supprimer définitivement' }).click();
  await expect(page).toHaveURL(/\/foyer$/);
  await expect(page.getByText('Ajoutez votre enfant')).toBeVisible();
});

test('a code pairs the child’s phone, which sees it, and the guardian disconnects it', async ({ page, browser }, testInfo) => {
  await guardian(page, 'jumelage');
  await addChild(page, 'Noé');
  await expect(page.getByText('Aucun appareil relié.')).toBeVisible();
  await page.getByRole('button', { name: 'Relier un appareil' }).click();
  const code = await page.getByText(/^[0-9A-Z]{4}-[0-9A-Z]{4}$/).textContent();

  const phone = await childPhone(browser, testInfo);
  const child = await phone.newPage();
  await child.goto('/connexion');
  await child.getByRole('link', { name: 'Tu es élève ? Relie cet appareil' }).click();
  await child.getByLabel('Le code').fill(code ?? '');
  await child.getByRole('button', { name: 'Relier' }).click();
  await expect(child.getByRole('heading', { name: 'Bonjour Noé' })).toBeVisible();
  await expect(child.getByRole('listitem')).toHaveCount(1);

  // The guardian's list follows the pairing on its own.
  await expect(page.getByRole('button', { name: 'Déconnecter' })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Déconnecter' }).click();
  await expect(page.getByText('Aucun appareil relié.')).toBeVisible();

  await child.reload();
  await expect(child).toHaveURL(/\/connexion$/);
  await phone.close();
});
