import { expect, test, type Page } from '@playwright/test';
import { codeSince, logMark } from '../server-log';
import { guardian } from '../guardian';

// The browser's ceremony, against Chromium's virtual authenticator, a DevTools domain WebKit lacks.
test.skip(({ browserName }) => browserName !== 'chromium', 'The virtual authenticator is Chromium’s');

/**
 * This page's own phone lock: it says yes at once, as a person who unlocks it, to the address
 * field's offer too, which then lets them in by itself. Its presence held back, it waits.
 */
async function phoneLock(page: Page) {
  const devtools = await page.context().newCDPSession(page);
  await devtools.send('WebAuthn.enable');
  const { authenticatorId } = await devtools.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  return {
    /** The names the phone files its passkeys under, as its own list shows them. */
    filedUnder: async () => (await devtools.send('WebAuthn.getCredentials', { authenticatorId })).credentials.map(({ userName }) => userName),
    present: (enabled: boolean) => devtools.send('WebAuthn.setAutomaticPresenceSimulation', { authenticatorId, enabled }),
  };
}

const makePasskey = (page: Page) => page.getByRole('button', { name: 'Créer une clé d’accès sur cet appareil' }).click();

test('a parent makes a passkey on their phone, filed under their address, and the address field lets them in with it', async ({ page }) => {
  const lock = await phoneLock(page);
  const email = await guardian(page, 'cle');
  await makePasskey(page);
  await expect(page.getByText('Android · Chrome')).toBeVisible();
  await expect(page.getByText(/^Créée le /)).toBeVisible();
  expect(await lock.filedUnder()).toEqual([email]);

  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(page).toHaveURL(/\/foyer$/);
  await expect(page.getByRole('heading', { name: 'Bonjour Claire' })).toBeVisible();
});

test('the button gets a parent in with their passkey, without a code', async ({ page }) => {
  const lock = await phoneLock(page);
  await guardian(page, 'cle-bouton');
  await makePasskey(page);
  await expect(page.getByText(/^Créée le /)).toBeVisible();

  await lock.present(false);
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(page).toHaveURL(/\/connexion$/);
  await expect(page.getByLabel('Adresse e-mail')).toHaveAttribute('autocomplete', 'username webauthn');
  await page.getByRole('button', { name: 'Entrer avec une clé d’accès' }).click();
  await lock.present(true);
  await expect(page).toHaveURL(/\/foyer$/);
});

test('a passkey the parent deleted no longer gets them in, and the screen sends them to the code', async ({ page }) => {
  await phoneLock(page);
  await guardian(page, 'cle-supprimee');
  await makePasskey(page);
  await page.getByRole('button', { name: 'Supprimer' }).click();
  await expect(page.getByText(/^Créée le /)).toHaveCount(0);

  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(page.getByRole('alert')).toHaveText('Tom ne connaît plus cette clé d’accès : entrez avec un code reçu par e-mail.');
  await expect(page).toHaveURL(/\/connexion$/);
});

// page.route never sees what the service worker answers.
test.describe('past the minutes after entering', () => {
  test.use({ serviceWorkers: 'block' });

  test('a code confirms who is there before the passkey is made', async ({ page }) => {
    await phoneLock(page);
    const email = await guardian(page, 'cle-tardive');
    // The server's own refusal of an old session is proven in its suite: here, the screen's answer.
    await page.route('**/api/auth/passkey/generate-register-options*', (route) =>
      route.fulfill({ status: 403, json: { code: 'SESSION_NOT_FRESH', message: 'Session is not fresh' } }),
    );
    await makePasskey(page);
    await expect(page.getByText('Par sécurité, une clé d’accès se crée dans les 10 minutes')).toBeVisible();

    await page.unroute('**/api/auth/passkey/generate-register-options*');
    const mark = logMark();
    await page.getByRole('button', { name: 'Recevoir un code' }).click();
    let code: string | undefined;
    await expect.poll(() => (code = codeSince(mark, email))).toBeDefined();
    await page.getByLabel('Le code reçu par e-mail').fill(code ?? '');
    await page.getByRole('button', { name: 'Confirmer' }).click();

    await makePasskey(page);
    await expect(page.getByText(/^Créée le /)).toBeVisible();
  });
});
