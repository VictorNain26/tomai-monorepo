import { expect, test, type Page } from '@playwright/test';
import { confirmEmail } from '../database';

// iPhone and Android run side by side on one database: each test has its own address.
const address = (name: string) => `${name}-${crypto.randomUUID().slice(0, 8)}@example.com`;

async function signUp(page: Page, email: string) {
  await page.goto('/inscription');
  await page.getByLabel('Votre prénom').fill('Claire');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill('un mot de passe solide');
  await page.getByRole('button', { name: 'Créer le compte' }).click();
}

async function signIn(page: Page, email: string) {
  await page.goto('/connexion');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill('un mot de passe solide');
  await page.getByRole('button', { name: 'Se connecter' }).click();
}

test('a parent signs up, is asked to confirm, is refused before, then reaches the household and signs out', async ({ page }) => {
  const email = address('parent');
  await signUp(page, email);
  await expect(page.getByRole('heading', { name: 'Vérifiez votre e-mail' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText(email);

  await signIn(page, email);
  await expect(page.getByRole('alert')).toContainText('Confirmez d’abord votre adresse');

  await confirmEmail(email);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/foyer$/);
  await expect(page.getByRole('heading', { name: 'Bonjour Claire' })).toBeVisible();

  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(page).toHaveURL(/\/connexion$/);
  await page.goto('/foyer');
  await expect(page).toHaveURL(/\/connexion$/);
});

test('a wrong password is refused in French, the form checked before it is sent', async ({ page }) => {
  await page.goto('/connexion');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByText('Une adresse e-mail valide.')).toBeVisible();

  await page.getByLabel('Adresse e-mail').fill(address('inconnu'));
  await page.getByLabel('Mot de passe').fill('pas le bon');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('alert')).toHaveText('Adresse ou mot de passe incorrect.');
});

test('a forgotten password gets the same answer for any address', async ({ page }) => {
  await page.goto('/mot-de-passe-oublie');
  await page.getByLabel('Adresse e-mail').fill(address('personne'));
  await page.getByRole('button', { name: 'Recevoir un lien' }).click();
  await expect(page.getByRole('status')).toContainText('Si un compte existe avec cette adresse');
});

test('a link without its token, or an expired one, says so', async ({ page }) => {
  await page.goto('/nouveau-mot-de-passe');
  await expect(page.getByRole('alert')).toHaveText('Ce lien est incomplet. Demandez-en un nouveau.');
  await page.goto('/nouveau-mot-de-passe?error=INVALID_TOKEN');
  await expect(page.getByRole('alert')).toHaveText('Ce lien n’est plus valable. Demandez-en un nouveau.');
  // A confirmation link that failed: better-auth sends it home with its error.
  await page.goto('/api/auth/verify-email?token=invalide&callbackURL=/');
  await expect(page).toHaveURL(/\/erreur-connexion\?error=INVALID_TOKEN$/);
  await expect(page.getByRole('alert')).toContainText('Ce lien n’est plus valable');
});
