import { expect, test } from '@playwright/test';
import { addChild, birthMonthAged, childPhone, guardian, signIn } from '../guardian';

test('a guardian adds a child, changes their class, then deletes their account', async ({ page }) => {
  await guardian(page, 'foyer');
  await expect(page.getByText('Ajoutez votre enfant')).toBeVisible();
  await addChild(page, 'Léa');

  await page.getByLabel('Sa classe', { exact: true }).selectOption({ label: 'Troisième' });
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('status')).toHaveText('Enregistré.');
  await page.getByLabel('Son prénom', { exact: true }).fill('Léa-Rose');
  await expect(page.getByText('Enregistré.')).toBeHidden();
  await page.getByLabel('Son prénom', { exact: true }).fill('Léa');

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
  // The sessions first; the devices folded, a tap away.
  await expect(child.getByText('Un appareil que tu ne reconnais pas ?')).toBeHidden();
  await child.getByText('Tes appareils reliés').click();
  await expect(child.getByRole('listitem')).toHaveCount(1);

  // The guardian's list follows the pairing on its own.
  await expect(page.getByRole('button', { name: 'Déconnecter' })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('L’appareil de Noé est relié.')).toBeVisible();
  await expect(page.getByText(/^[0-9A-Z]{4}-[0-9A-Z]{4}$/)).toBeHidden();
  await page.getByRole('button', { name: 'Déconnecter' }).click();
  await expect(page.getByText('Aucun appareil relié.')).toBeVisible();

  await child.reload();
  await expect(child).toHaveURL(/\/connexion$/);
  await phone.close();
});

// page.route never sees what the service worker answers.
test.describe('with the session gone', () => {
  test.use({ serviceWorkers: 'block' });

  test('a request refused for a lost session sends the guardian back to the sign-in', async ({ page }) => {
    await guardian(page, 'perdu');
    await page.route('**/api/household/students', (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ status: 401, contentType: 'application/problem+json', json: { status: 401, code: 'UNAUTHENTICATED' } })
        : route.fallback(),
    );
    await page.getByLabel('Son prénom', { exact: true }).fill('Léo');
    await page.getByLabel('Sa classe', { exact: true }).selectOption({ label: 'Sixième' });
    await page.getByLabel('Son mois de naissance').fill(birthMonthAged(11));
    await page.getByRole('button', { name: 'Ajouter' }).click();
    await expect(page).toHaveURL(/\/connexion$/);
  });
});

test('on the family phone, the parent opens the child’s space without a code, and enters back by their own', async ({ page }) => {
  const email = await guardian(page, 'famille');
  await addChild(page, 'Zoé');
  const openZoe = page.getByRole('button', { name: 'Ouvrir l’espace de Zoé sur cet appareil' });
  await openZoe.click();
  await expect(page.getByRole('heading', { name: 'Bonjour Zoé' })).toBeVisible();
  // A child does not cut themselves off by mistake: their parent unpairs a device.
  await expect(page.getByRole('button', { name: /déconnecter/i })).toHaveCount(0);

  await page.getByRole('link', { name: 'Changer de profil' }).click();
  await expect(page).toHaveURL(/\/connexion$/);
  // A choice of who uses Tom, not the generic sign-in.
  await expect(page.getByRole('heading', { level: 1, name: 'Qui utilise Tom ?' })).toBeVisible();
  await expect(page.getByText('Tom est en bêta fermée')).toBeHidden();
  await page.getByRole('link', { name: 'C’est Zoé' }).click();
  await expect(page.getByRole('heading', { name: 'Bonjour Zoé' })).toBeVisible();
  await page.getByRole('link', { name: 'Changer de profil' }).click();
  await signIn(page, email);
  await expect(page).toHaveURL(/\/foyer$/);
  // Leaving, the parent hands the phone back: Zoé's space stays on it.
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(page.getByRole('heading', { name: 'Bonjour Zoé' })).toBeVisible();

  await page.getByRole('link', { name: 'Changer de profil' }).click();
  await signIn(page, email);
  await expect(page).toHaveURL(/\/foyer$/);
  await page.getByRole('link', { name: /^Zoé/ }).click();
  await openZoe.click();
  await expect(page.getByRole('heading', { name: 'Bonjour Zoé' })).toBeVisible();
  // The same session, switched back to: no second pairing.
  await expect(page.getByText(/^Relié le /)).toHaveCount(1);
});

test('in 5e, the parent does the homework with the child on the family phone, and pairs no device of the child’s', async ({ page }) => {
  await guardian(page, 'accompagne');
  await addChild(page, 'Lou', { level: 'Cinquième' });
  await expect(page.getByRole('button', { name: 'Relier un appareil' })).toHaveCount(0);
  await expect(page.getByText('En 6e et 5e, Lou travaille sur l’appareil de la famille')).toBeVisible();

  await page.getByRole('button', { name: 'Faire les devoirs avec Lou' }).click();
  await expect(page.getByRole('heading', { name: 'Bonjour Lou' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Avec mon parent à côté' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sans mon parent ce soir' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nouvelle séance' })).toHaveCount(0);
  // The child knows what their parent can see on this device.
  await expect(
    page.getByText('Quand tu travailles sur l’appareil de ta famille, ton parent peut ouvrir ton espace et relire tes séances.'),
  ).toBeVisible();
});
