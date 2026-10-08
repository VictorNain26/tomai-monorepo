import { expect, test, type Page } from '@playwright/test';
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { pairedStudent } from '../guardian';

// page.route never sees what the service worker answers.
test.use({ serviceWorkers: 'block' });

/** A turn answered as the server answers it, with the AI SDK's own stream. */
async function tutorReplies(page: Page, reply: string) {
  const response = createUIMessageStreamResponse({
    stream: createUIMessageStream({
      execute: ({ writer }) => {
        writer.write({ type: 'text-start', id: 'reply' });
        writer.write({ type: 'text-delta', id: 'reply', delta: reply });
        writer.write({ type: 'text-end', id: 'reply' });
      },
    }),
  });
  const body = await response.text();
  const sent: unknown[] = [];
  await page.route('**/api/sessions/*/messages', (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    sent.push(route.request().postDataJSON());
    return route.fulfill({ status: 200, headers: Object.fromEntries(response.headers), body });
  });
  return sent;
}

test('a paired student opens a session, writes to Tom and reads his reply', async ({ page, browser }, testInfo) => {
  await pairedStudent(page, browser, testInfo, 'Inès');
  const sent = await tutorReplies(page, 'Que fais-tu du + 5 ?');

  await page.getByRole('button', { name: 'Nouvelle séance' }).click();
  await expect(page.getByRole('heading', { name: 'Séance avec Tom' })).toBeVisible();
  await page.getByLabel('Ton message').fill('Je bloque sur 3x + 5 = 20');
  await page.getByRole('button', { name: 'Envoyer' }).click();

  // AI Act art. 50(1): the student is told they talk to an AI before their first message is answered,
  // by a mark under the field, in sight all through the session and read with the field.
  const aiNotice = 'Tom est une IA : il peut se tromper, vérifie avec ton cours.';
  await expect(page.getByText(aiNotice)).toBeVisible();
  await expect(page.getByLabel('Ton message')).toHaveAccessibleDescription(aiNotice);
  const conversation = page.getByRole('list', { name: 'Conversation' });
  await expect(conversation.getByRole('listitem')).toHaveText(['Toi : Je bloque sur 3x + 5 = 20', 'Tom : Que fais-tu du + 5 ?']);
  // Tom's head beside his message, never beside the student's.
  await expect(conversation.getByRole('listitem').last().locator('img')).toHaveCount(1);
  await expect(conversation.getByRole('listitem').first().locator('img')).toHaveCount(0);
  // The server keeps the conversation: the turn carries the new message only.
  expect(sent).toEqual([{ text: 'Je bloque sur 3x + 5 = 20', inputMode: 'text' }]);

  await page.getByRole('link', { name: 'Retour à tes séances' }).click();
  await expect(page.getByRole('link', { name: /Séance sans titre/ })).toBeVisible();
});

test('while Tom answers, the student is told what he does', async ({ page, browser }, testInfo) => {
  await pairedStudent(page, browser, testInfo, 'Lou');
  let answer = () => undefined as unknown;
  await page.route('**/api/sessions/*/messages', (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    answer = () => route.fulfill({ status: 409, contentType: 'application/problem+json', json: { status: 409, code: 'TURN_IN_PROGRESS' } });
    return undefined;
  });

  await page.getByRole('button', { name: 'Nouvelle séance' }).click();
  await page.getByLabel('Ton message').fill('Résous 3x + 5 = 20');
  await page.getByRole('button', { name: 'Envoyer' }).click();
  await expect(page.getByText('Tom lit ton message…')).toBeVisible();
  await answer();
});

test('in a long conversation, the field and the AI mark stay at the bottom of the screen', async ({ page, browser }, testInfo) => {
  await pairedStudent(page, browser, testInfo, 'Noa');
  await tutorReplies(page, Array.from({ length: 40 }, (_, line) => `Ligne ${String(line + 1)} de l’explication.`).join('\n'));

  await page.getByRole('button', { name: 'Nouvelle séance' }).click();
  await page.getByLabel('Ton message').fill('Explique-moi');
  await page.getByRole('button', { name: 'Envoyer' }).click();
  await expect(page.getByText('Ligne 40 de l’explication.')).toBeVisible();
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
  await expect(page.getByRole('heading', { name: 'Séance avec Tom' })).toBeInViewport();
  await expect(page.getByLabel('Ton message')).toBeInViewport();
  await expect(page.getByText('Tom est une IA : il peut se tromper, vérifie avec ton cours.')).toBeInViewport();
});

test('a day past the quota is told in French, without the server’s message', async ({ page, browser }, testInfo) => {
  await pairedStudent(page, browser, testInfo, 'Malo');
  await page.route('**/api/sessions/*/messages', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({ status: 429, contentType: 'application/problem+json', json: { status: 429, code: 'QUOTA_EXCEEDED', title: 'internal' } })
      : route.fallback(),
  );

  await page.getByRole('button', { name: 'Nouvelle séance' }).click();
  await page.getByLabel('Ton message').fill('Bonjour');
  await page.getByRole('button', { name: 'Envoyer' }).click();
  await expect(page.getByRole('alert')).toHaveText('Le temps avec Tom est fini pour aujourd’hui. Reviens demain !');
  // Nothing was stored: the message leaves the conversation and comes back to the field.
  await expect(page.getByRole('list', { name: 'Conversation' }).getByRole('listitem')).toHaveCount(0);
  await expect(page.getByLabel('Ton message')).toHaveValue('Bonjour');
});
