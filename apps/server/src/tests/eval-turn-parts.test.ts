import { describe, it, expect } from 'bun:test';
import { collectStrings, cookieHeader, readTurnParts } from '../eval/turn-parts';
import type { TomChatMessage } from '../modules/tutor/chat-ui-message';

describe('collectStrings', () => {
  it('keeps every string leaf on its own line, newlines included', () => {
    expect(collectStrings({ cards: [{ front: 'Calcule', back: 'Étapes :\nx = 5' }], count: 2, ok: true, none: null }))
      .toBe('Calcule\nÉtapes :\nx = 5\n2');
  });
});

describe('readTurnParts', () => {
  it('reads the text, the tools called, their outputs and the decks created', () => {
    const parts: TomChatMessage['parts'] = [
      { type: 'text', text: 'Voici tes fiches. ' },
      {
        type: 'tool-generate_flashcards',
        toolCallId: 'c1',
        state: 'output-available',
        input: { topic: 'accord', subject: 'francais' },
        output: { message: 'Fiches créées', deck: { title: 'Accords' } },
      },
      { type: 'data-deck-created', data: { deckId: 'd1', title: 'Accords', cardCount: 3, subject: 'francais' } },
      { type: 'text', text: 'Bon courage !' },
    ];

    expect(readTurnParts(parts)).toEqual({
      text: 'Voici tes fiches. Bon courage !',
      tools: ['generate_flashcards'],
      toolOutputs: 'Fiches créées\nAccords\nd1\nAccords\n3\nfrancais',
      deckIds: ['d1'],
    });
  });

  it('returns empty fields for a turn without parts', () => {
    expect(readTurnParts([])).toEqual({ text: '', tools: [], toolOutputs: '', deckIds: [] });
  });
});

describe('cookieHeader', () => {
  it('joins the name=value pairs of the Set-Cookie headers', () => {
    expect(cookieHeader(['a=1; Path=/; HttpOnly', 'b=2; Secure'])).toBe('a=1; b=2');
    expect(cookieHeader([])).toBe('');
  });
});
