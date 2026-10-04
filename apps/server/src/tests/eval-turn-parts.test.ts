import { describe, it, expect } from 'bun:test';
import { collectStrings, cookieHeader, deckText, readTurnParts } from '../eval/turn-parts';
import type { TomChatMessage } from '../modules/tutor/chat-ui-message';

describe('collectStrings', () => {
  it('keeps every string leaf on its own line, newlines included', () => {
    expect(collectStrings({ cards: [{ front: 'Calcule', back: 'Étapes :\nx = 5' }], count: 2, ok: true, none: null }))
      .toBe('Calcule\nÉtapes :\nx = 5\n2');
  });
});

describe('deckText', () => {
  it('keeps what the revision screen shows: title, description and card text, never ids, dates or answer indexes', () => {
    const deck = {
      deck: { id: 'd-19', userId: 'u', title: 'Priorités', description: null, createdAt: '2026-10-04T14:19:22.123Z', cardCount: 19 },
      cards: [{ id: 'c1', content: { sentence: '4 + 3 × 5 = ___', options: ['35', '19'], correctIndex: 1 }, fsrsData: { due: '2026-10-05' }, position: 19 }],
    };
    expect(deckText(deck)).toBe('Priorités\n4 + 3 × 5 = ___\n35\n19');
    expect(deckText({ ...deck, cards: [] })).toBe('Priorités');
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

  it('leaves out a call the code denied: it made nothing', () => {
    const parts: TomChatMessage['parts'] = [
      {
        type: 'tool-generate_flashcards',
        toolCallId: 'c1',
        state: 'output-denied',
        input: { topic: 'accord', subject: 'francais' },
        approval: { id: 'a1', approved: false, reason: "L'élève n'a pas demandé de cartes", isAutomatic: true },
      },
      { type: 'text', text: 'Veux-tu des cartes sur les accords ?' },
    ];

    expect(readTurnParts(parts)).toEqual({ text: 'Veux-tu des cartes sur les accords ?', tools: [], toolOutputs: '', deckIds: [] });
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
