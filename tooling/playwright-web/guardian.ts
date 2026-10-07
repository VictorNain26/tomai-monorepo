/** A guardian's account in the suite's database: signed up, confirmed, signed in. */

import { expect, type Page } from '@playwright/test';
import { confirmEmail } from './database';

// iPhone and Android run side by side on one database: each test has its own address.
export const address = (name: string) => `${name}-${crypto.randomUUID().slice(0, 8)}@example.com`;

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
