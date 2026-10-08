import { expect, test } from '@playwright/test';
import { invite } from '../database';
import { address, askCode, guardian, signIn } from '../guardian';

test('an invited parent gets in by the code their address received, names themselves, and signs out', async ({ page }) => {
  const email = address('parent');
  invite(email);
  await signIn(page, email);
  await expect(page.getByRole('heading', { name: 'Bienvenue' })).toBeVisible();
  // Signed in but nameless: the household sends them back until they give it.
  await page.goto('/foyer');
  await expect(page.getByRole('heading', { name: 'Bienvenue' })).toBeVisible();
  await page.getByLabel('Votre prénom').fill('Claire');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page).toHaveURL(/\/foyer$/);
  await expect(page.getByRole('heading', { name: 'Bonjour Claire' })).toBeVisible();

  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(page).toHaveURL(/\/connexion$/);
  await page.goto('/foyer');
  await expect(page).toHaveURL(/\/connexion$/);

  await signIn(page, email);
  await expect(page).toHaveURL(/\/foyer$/);
});

test('the sign-in says the beta is closed, checks the address and the code, and refuses a wrong one in French', async ({ page }) => {
  await page.goto('/connexion');
  await expect(page.getByRole('status')).toContainText('bêta fermée');
  // Under 16 px, iOS Safari zooms on the field it focuses.
  expect(await page.getByLabel('Adresse e-mail').evaluate((field) => getComputedStyle(field).fontSize)).toBe('16px');
  await page.getByRole('button', { name: 'Recevoir mon code' }).click();
  await expect(page.getByText('Une adresse e-mail valide.')).toBeVisible();

  const email = address('maladroit');
  invite(email);
  const code = await askCode(page, email);
  await expect(page.getByRole('status')).toContainText(email);
  const field = page.getByLabel('Le code reçu par e-mail');
  await expect(field).toHaveAttribute('autocomplete', 'one-time-code');
  await field.fill('12');
  await page.getByRole('button', { name: 'Entrer' }).click();
  await expect(page.getByText('Le code à 6 chiffres reçu par e-mail.')).toBeVisible();
  await field.fill(code === '111111' ? '222222' : '111111');
  await page.getByRole('button', { name: 'Entrer' }).click();
  await expect(page.getByRole('alert')).toHaveText('Ce code ne correspond pas. Vérifiez-le, ou demandez-en un nouveau.');
});

test('an address without an invitation is answered as any other, and gets no code', async ({ page }) => {
  await page.goto('/connexion');
  const email = address('sans-invitation');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByRole('button', { name: 'Recevoir mon code' }).click();
  await expect(page.getByRole('heading', { name: 'Votre code' })).toBeVisible();
  await page.getByLabel('Le code reçu par e-mail').fill('000000');
  await page.getByRole('button', { name: 'Entrer' }).click();
  await expect(page.getByRole('alert')).toHaveText('Ce code ne correspond pas. Vérifiez-le, ou demandez-en un nouveau.');
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
