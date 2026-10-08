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

test('while Tom answers, the student is told what he does, step by step', async ({ page, browser }, testInfo) => {
  await pairedStudent(page, browser, testInfo, 'Lou');
  // A turn the test streams chunk by chunk, as the server does: page.route can only answer whole.
  const { headers } = createUIMessageStreamResponse({ stream: createUIMessageStream({ execute: () => undefined }) });
  await page.evaluate((streamHeaders) => {
    const encoder = new TextEncoder();
    const original = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      if (init?.method !== 'POST' || !url.endsWith('/messages')) return original(input, init);
      const body = new ReadableStream<Uint8Array>({
        start: (controller) => {
          Object.assign(window, {
            pushChunk: (chunk: unknown) => {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
            },
            endStream: () => {
              controller.close();
            },
          });
        },
      });
      return Promise.resolve(new Response(body, { headers: streamHeaders }));
    };
  }, Object.fromEntries(headers));
  const push = (chunk: object) =>
    page.evaluate((sent) => {
      (window as unknown as { pushChunk: (chunk: unknown) => void }).pushChunk(sent);
    }, chunk);

  await page.getByRole('button', { name: 'Nouvelle séance' }).click();
  await page.getByLabel('Ton message').fill('Résous 3x + 5 = 20');
  await page.getByRole('button', { name: 'Envoyer' }).click();
  await expect(page.getByText('Tom lit ton message…')).toBeVisible();
  await push({ type: 'data-step', data: 'exercise', transient: true });
  await expect(page.getByText('Tom prépare ton exercice, ça prend quelques secondes…')).toBeVisible();
  await push({ type: 'data-step', data: 'writing', transient: true });
  await expect(page.getByText('Tom écrit sa réponse…')).toBeVisible();
  await push({ type: 'text-start', id: 'reply' });
  await push({ type: 'text-delta', id: 'reply', delta: 'Que fais-tu du + 5 ?' });
  await push({ type: 'text-end', id: 'reply' });
  await page.evaluate(() => {
    (window as unknown as { endStream: () => void }).endStream();
  });

  const conversation = page.getByRole('list', { name: 'Conversation' });
  // The steps are never kept in the conversation.
  await expect(conversation.getByRole('listitem')).toHaveText(['Toi : Résous 3x + 5 = 20', 'Tom : Que fais-tu du + 5 ?']);
  await expect(page.getByText('Tom écrit sa réponse…')).toHaveCount(0);
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

  // Sent from up in the conversation, the message, the wait and the reply come into sight.
  await page.getByLabel('Ton message').fill('Et la ligne 3 ?');
  await page.getByRole('button', { name: 'Envoyer' }).click();
  await expect(page.getByRole('list', { name: 'Conversation' }).getByRole('listitem').last()).toBeInViewport();
});

test('Tom’s formatting and formulas render, his links, images and HTML never do', async ({ page, browser }, testInfo) => {
  await pairedStudent(page, browser, testInfo, 'Zoé');
  const refused: string[] = [];
  page.on('console', (message) => {
    if (message.text().includes('Content Security Policy')) refused.push(message.text());
  });
  await tutorReplies(page, '**Bien vu.** Que vaut $\\frac{3}{4}$ ? [un lien](https://exemple.fr) ![image](https://exemple.fr/x.png) <b>html</b>');

  await page.getByRole('button', { name: 'Nouvelle séance' }).click();
  await page.getByLabel('Ton message').fill('Aide-moi');
  await page.getByRole('button', { name: 'Envoyer' }).click();

  const reply = page.getByRole('list', { name: 'Conversation' }).getByRole('listitem').last();
  await expect(reply.getByText('Bien vu.', { exact: true })).toHaveCSS('font-weight', /^(600|700)$/);
  await expect(reply.locator('.katex')).toHaveCount(1);
  await expect(reply).not.toContainText('**');
  await expect(reply).not.toContainText('$');
  await expect(reply.locator('a, b')).toHaveCount(0);
  // Tom's head only: no image of the model's.
  await expect(reply.locator('img')).toHaveCount(1);
  expect(refused).toEqual([]);
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
