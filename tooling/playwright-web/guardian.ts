/** A guardian's account in the suite's database: signed up, confirmed, signed in. */

import { devices, expect, type Browser, type Page, type TestInfo } from '@playwright/test';
import { confirmEmail } from './database';

// iPhone and Android run side by side on one database: each test has its own address.
// In lowercase ASCII, as better-auth stores an address: confirmEmail finds it by its text.
export const address = (name: string) =>
  `${name
    .normalize('NFD')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .toLowerCase()}-${crypto.randomUUID().slice(0, 8)}@example.com`;

export async function signUp(page: Page, email: string) {
  await page.goto('/inscription');
  await page.getByLabel('Votre prénom').fill('Claire');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill('un mot de passe solide');
  await page.getByRole('button', { name: 'Créer le compte' }).click();
  await expect(page.getByRole('heading', { name: 'Vérifiez votre e-mail' })).toBeVisible();
}

export async function signIn(page: Page, email: string) {
  await page.goto('/connexion');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill('un mot de passe solide');
  await page.getByRole('button', { name: 'Se connecter' }).click();
}

/** A guardian at home, on their household. */
export async function guardian(page: Page, name: string) {
  const email = address(name);
  await signUp(page, email);
  await confirmEmail(email);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/foyer$/);
}

/** The child's own phone, of the same kind as the guardian's. */
export const childPhone = (browser: Browser, testInfo: TestInfo) =>
  browser.newContext({ ...devices[testInfo.project.name === 'iphone' ? 'iPhone 15' : 'Pixel 7'] });

/** A child added to the household, the guardian left on their page. */
export async function addChild(page: Page, name: string) {
  await page.getByLabel('Son prénom', { exact: true }).fill(name);
  await page.getByLabel('Sa classe', { exact: true }).selectOption({ label: 'Cinquième' });
  await page.getByLabel('Son mois de naissance').fill('2014-03');
  await page.getByRole('button', { name: 'Ajouter' }).click();
  await page.getByRole('link', { name: new RegExp(`^${name}`) }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

/** A student whose device `page` is, paired by a guardian on a phone of their own. */
export async function pairedStudent(page: Page, browser: Browser, testInfo: TestInfo, name: string) {
  const phone = await childPhone(browser, testInfo);
  const parent = await phone.newPage();
  await guardian(parent, `parent-${name}`);
  await addChild(parent, name);
  await parent.getByRole('button', { name: 'Relier un appareil' }).click();
  const code = (await parent.getByText(/^[0-9A-Z]{4}-[0-9A-Z]{4}$/).textContent()) ?? '';
  await phone.close();

  await page.goto('/jumeler');
  await page.getByLabel('Le code').fill(code);
  await page.getByRole('button', { name: 'Relier' }).click();
  await expect(page.getByRole('heading', { name: `Bonjour ${name}` })).toBeVisible();
}
