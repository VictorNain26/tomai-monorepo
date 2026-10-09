/** A guardian's account in the suite's database: invited, in by the code their address received. */

import { devices, expect, type Browser, type Page, type TestInfo } from '@playwright/test';
import { invite } from './database';
import { codeSince, logMark } from './server-log';

// iPhone and Android run side by side on one database: each test has its own address, in
// lowercase ASCII, as better-auth stores it.
/**
 * The birth month of a child exactly this old all year, up to 19: December of the year before,
 * since a birthday counts once its month is over (domain/memory-consent.ts). A fixed year would
 * leave the accepted ages one day.
 */
export const birthMonthAged = (years: number, now = new Date()) => `${String(now.getUTCFullYear() - years - 1)}-12`;

export const address = (name: string) =>
  `${name
    .normalize('NFD')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .toLowerCase()}-${crypto.randomUUID().slice(0, 8)}@example.com`;

/** The address asked for its code on the sign-in screen: the code the server logged for it. */
export async function askCode(page: Page, email: string) {
  await page.goto('/connexion');
  await page.getByLabel('Adresse e-mail').fill(email);
  const mark = logMark();
  await page.getByRole('button', { name: 'Recevoir mon code' }).click();
  await expect(page.getByRole('heading', { name: 'Votre code' })).toBeVisible();
  let code: string | undefined;
  await expect.poll(() => (code = codeSince(mark, email))).toBeDefined();
  return code ?? '';
}

/** In by the code: an account that exists lands on its home, a first one is asked for a first name. */
export async function signIn(page: Page, email: string) {
  const code = await askCode(page, email);
  await page.getByLabel('Le code reçu par e-mail').fill(code);
  await page.getByRole('button', { name: 'Entrer' }).click();
}

/** A guardian at home, on their household, named Claire: their address. */
export async function guardian(page: Page, name: string) {
  const email = address(name);
  invite(email);
  await signIn(page, email);
  await page.getByLabel('Votre prénom').fill('Claire');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page).toHaveURL(/\/foyer$/);
  return email;
}

/** The child's own phone, of the same kind as the guardian's. */
export const childPhone = (browser: Browser, testInfo: TestInfo) =>
  browser.newContext({ ...devices[testInfo.project.name === 'iphone' ? 'iPhone 15' : 'Pixel 7'] });

/**
 * A child added to the household, the learner memory proposed or not, the guardian left on their
 * page. In 4e by default: a device of their own pairs from the 4e on.
 */
export async function addChild(page: Page, name: string, { memory = false, level = 'Quatrième' } = {}) {
  // Folded once a child exists: wait for the household to show one or the other.
  const unfold = page.getByRole('button', { name: 'Ajouter un enfant' });
  const firstName = page.getByLabel('Son prénom', { exact: true });
  await expect(unfold.or(firstName)).toBeVisible();
  if (await unfold.isVisible()) await unfold.click();
  await firstName.fill(name);
  if (memory) await page.getByLabel('Proposer que Tom retienne ce qui a résisté').check();
  await page.getByLabel('Sa classe', { exact: true }).selectOption({ label: level });
  await page.getByLabel('Son mois de naissance').fill(birthMonthAged(12));
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

/** A student whose device `page` is, paired by a guardian on a phone of their own: the guardian's address. */
export async function pairedStudent(page: Page, browser: Browser, testInfo: TestInfo, name: string, { memory = false } = {}) {
  const phone = await childPhone(browser, testInfo);
  const parent = await phone.newPage();
  const parentEmail = await guardian(parent, `parent-${name}`);
  await addChild(parent, name, { memory });
  await parent.getByRole('button', { name: 'Relier un appareil' }).click();
  const code = (await parent.getByText(/^[0-9A-Z]{4}-[0-9A-Z]{4}$/).textContent()) ?? '';
  await phone.close();

  await page.goto('/jumeler');
  await page.getByLabel('Le code').fill(code);
  await page.getByRole('button', { name: 'Relier' }).click();
  await expect(page.getByRole('heading', { name: `Bonjour ${name}` })).toBeVisible();
  return parentEmail;
}
