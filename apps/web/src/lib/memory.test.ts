import { describe, expect, it } from 'bun:test';
import { Hono } from 'hono';
import { hc } from 'hono/client';
import { parseResponse } from './api';
import { memoryMessage, notionSummary } from './memory';

const notion = { notionId: 'n', label: 'Équations', worked: 2, lastSolved: false, lastHelp: 'Indice ciblé' as const, watch: 'mal lire la consigne' };

describe('notionSummary', () => {
  it('says how often, how it ended last time with what help, and what to watch', () => {
    expect(notionSummary(notion)).toBe(
      'Travaillée 2 fois. La dernière fois : pas résolue, aide jusqu’à « Indice ciblé ». À surveiller : mal lire la consigne.',
    );
  });

  it('says nothing to watch without a frequent error', () => {
    expect(notionSummary({ ...notion, lastSolved: true, watch: null })).toBe(
      'Travaillée 2 fois. La dernière fois : résolue, aide jusqu’à « Indice ciblé ».',
    );
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

  it('tells a student whose parent does not, or no longer, propose it to ask them', async () => {
    expect(memoryMessage(await refused('FORBIDDEN', 403))).toBe('Ton parent ne te la propose pas, ou plus : demande-lui.');
  });

  it('falls back for anything else', async () => {
    expect(memoryMessage(await refused('INTERNAL_ERROR', 500))).toBe('Ça n’a pas marché. Réessaie dans un instant.');
  });
});
