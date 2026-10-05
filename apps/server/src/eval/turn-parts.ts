import { isDataUIPart, isTextUIPart, isToolUIPart } from 'ai';
import { z } from 'zod';
import type { TomChatMessage } from '../modules/tutor/index.js';
import { collectStrings } from '../lib/collect-strings.js';

export interface TutorTurn {
  student: string;
  /** The student spoke the turn: it went through the voice channel. */
  inputMode?: 'voice';
  text: string;
  tools: string[];
  /** Strings of the tool outputs and data parts: what the client receives besides the text. */
  toolOutputs: string;
  /** Strings of the flashcards created during the turn, as the revision screen shows them. */
  cards: string;
  durationMs: number;
  error?: string;
}

export interface Transcript {
  scenarioId: string;
  exerciseId: string;
  repetition: number;
  turns: TutorTurn[];
}

const deckResponse = z.object({
  deck: z.object({ title: z.string(), description: z.string().nullable() }),
  cards: z.array(z.object({ content: z.unknown() })),
});

/**
 * What the revision screen shows of a deck (`GET /api/learning/decks/:id`): its title, its
 * description and the text of its cards. Ids, dates, review data and the indexes of the right
 * answers are not shown, and a number among them could pass for a leak.
 */
export function deckText(json: unknown): string {
  const { deck, cards } = deckResponse.parse(json);
  return [deck.title, deck.description ?? '', ...cards.map((card) => collectStrings(card.content, false))].filter(Boolean).join('\n');
}

/**
 * What a tutor message shows: its text, the tools it called, their outputs, the decks created. A
 * call the code denied ran nothing and is left out.
 */
export function readTurnParts(parts: TomChatMessage['parts']): Pick<TutorTurn, 'text' | 'tools' | 'toolOutputs'> & { deckIds: string[] } {
  const toolParts = parts.filter(isToolUIPart).filter((part) => part.state !== 'output-denied');
  const dataParts = parts.filter(isDataUIPart);
  return {
    text: parts.filter(isTextUIPart).map((part) => part.text).join(''),
    tools: toolParts.map((part) => part.type.replace(/^tool-/, '')),
    toolOutputs: [...toolParts.map((part) => collectStrings(part.output)), ...dataParts.map((part) => collectStrings(part.data))]
      .filter(Boolean)
      .join('\n'),
    deckIds: dataParts.map((part) => part.data.deckId),
  };
}

/** `Cookie` request header from the `Set-Cookie` headers of a sign-in response. */
export function cookieHeader(setCookies: readonly string[]): string {
  return setCookies.map((cookie) => cookie.split(';')[0]?.trim() ?? '').filter(Boolean).join('; ');
}
