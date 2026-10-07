import { describe, expect, it } from 'bun:test';
import { Hono } from 'hono';
import { hc } from 'hono/client';
import { parseResponse } from './api';
import { memoryMessage, notionSummary } from './memory';

const notion = { notionId: 'n', label: 'Équations', worked: 2, lastHintLevel: 3, lastSolved: false, frequentError: 'misinterpret' };

describe('notionSummary', () => {
  it('says how often, how it ended last time, and what to watch', () => {
    expect(notionSummary(notion)).toBe(
      "Travaillée 2 fois. La dernière fois : pas résolue, aide jusqu'au palier 3. À surveiller : mal lire la consigne.",
    );
  });

  it('says nothing to watch without a frequent error, or with one it does not know', () => {
    expect(notionSummary({ ...notion, lastSolved: true, frequentError: null })).toBe(
      "Travaillée 2 fois. La dernière fois : résolue, aide jusqu'au palier 3.",
    );
    expect(notionSummary({ ...notion, frequentError: 'new-kind' })).not.toContain('surveiller');
  });
});

describe('memoryMessage', () => {
  const refused = async (code: string, status: 403 | 500) => {
    const app = new Hono().get('/', (c) => c.json({ status, code }, status, { 'Content-Type': 'application/problem+json' }));
    return parseResponse(hc<typeof app>('http://localhost', { fetch: app.request }).index.$get()).then(
      () => null,
      (error: unknown) => error,
    );
  };

  it('tells a student whose parent did not propose it to ask them', async () => {
    expect(memoryMessage(await refused('FORBIDDEN', 403))).toStartWith('Ton parent ne te l’a pas proposée');
  });

  it('falls back for anything else', async () => {
    expect(memoryMessage(await refused('INTERNAL_ERROR', 500))).toBe('Ça n’a pas marché. Réessaie dans un instant.');
  });
});
