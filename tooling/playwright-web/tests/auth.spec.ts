import { expect, test } from '@playwright/test';
import { confirmEmail } from '../database';
import { address, fillSignUp, guardian, signIn, signUp } from '../guardian';

test('a parent signs up, is asked to confirm, is refused before, then reaches the household and signs out', async ({ page }) => {
  const email = address('parent');
  await signUp(page, email);
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

test('an address without an invitation is refused, the closed beta said before', async ({ page }) => {
  await fillSignUp(page, address('sans-invitation'));
  await expect(page.getByRole('status')).toContainText('bêta fermée');
  await expect(page.getByRole('alert')).toHaveText('Cette adresse n’a pas d’invitation, ou elle a expiré.');
});

test('a wrong password is refused in French, the form checked before it is sent', async ({ page }) => {
  await page.goto('/connexion');
  // Under 16 px, iOS Safari zooms on the field it focuses.
  expect(await page.getByLabel('Adresse e-mail').evaluate((field) => getComputedStyle(field).fontSize)).toBe('16px');
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

// page.route never sees what the service worker answers.
test.describe('with the server failing', () => {
  test.use({ serviceWorkers: 'block' });

  test('a sign-out the server refuses says so, and keeps the parent signed in', async ({ page }) => {
    await guardian(page, 'sortie');

    await page.route('**/api/auth/sign-out', (route) => route.fulfill({ status: 429, json: { code: 'TOO_MANY_REQUESTS' } }));
    await page.getByRole('button', { name: 'Se déconnecter' }).click();
    await expect(page.getByRole('alert')).toContainText('Trop d’essais');
    await expect(page).toHaveURL(/\/foyer$/);
  });

  test('a screen that cannot load says so in French, and loads on a retry', async ({ page }) => {
    await page.route('**/api/me', (route) =>
      route.fulfill({ status: 500, contentType: 'application/problem+json', json: { status: 500, code: 'INTERNAL_ERROR' } }),
    );
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Une erreur est survenue' })).toBeVisible();

    await page.unroute('**/api/me');
    await page.getByRole('button', { name: 'Réessayer' }).click();
    await expect(page).toHaveURL(/\/connexion$/);
  });
});
