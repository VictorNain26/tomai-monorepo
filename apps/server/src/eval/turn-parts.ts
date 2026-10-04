import { isDataUIPart, isTextUIPart, isToolUIPart } from 'ai';
import type { TomChatMessage } from '../modules/tutor/index.js';

export interface TutorTurn {
  student: string;
  /** The student spoke the turn: it went through the voice channel. */
  voice?: true;
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

/**
 * Every string leaf of a JSON value, one per line. Serialising with JSON.stringify would turn
 * a newline into the letters `\n`, glued to the next word.
 */
export function collectStrings(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(collectStrings).filter(Boolean).join('\n');
  if (value !== null && typeof value === 'object') {
    return Object.values(value).map(collectStrings).filter(Boolean).join('\n');
  }
  return '';
}

/** What a tutor message shows: its text, the tools it called, their outputs, the decks created. */
export function readTurnParts(parts: TomChatMessage['parts']): Pick<TutorTurn, 'text' | 'tools' | 'toolOutputs'> & { deckIds: string[] } {
  const toolParts = parts.filter(isToolUIPart);
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
