/**
 * History/Geography Card Validators
 *
 * Validators for history and geography card types:
 * - timeline (chronological ordering)
 * - matching_era (era association)
 * - cause_effect (cause and effect relationships)
 */

import type {
  TimelineContent,
  MatchingEraContent,
  CauseEffectContent,
} from '../types.js';
import type { ValidationResult } from './types.js';

/**
 * Validates timeline (chronological ordering) content
 */
export function validateTimeline(content: Record<string, unknown>): ValidationResult<TimelineContent> {
  const errors: string[] = [];

  const instruction = content.instruction;
  const events = content.events;
  const correctOrder = content.correctOrder;

  if (typeof instruction !== 'string' || instruction.trim().length === 0) {
    errors.push('instruction manquante ou vide');
  }

  if (!Array.isArray(events) || events.length < 2) {
    errors.push('events doit être un tableau avec au moins 2 événements');
  } else {
    for (let i = 0; i < events.length; i++) {
      const evt = events[i] as Record<string, unknown>;
      if (!evt || typeof evt.event !== 'string') {
        errors.push(`événement ${i + 1} invalide (doit avoir un champ event)`);
      }
    }
  }

  if (!Array.isArray(correctOrder) || correctOrder.length < 2) {
    errors.push('correctOrder doit être un tableau d\'indices');
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    content: {
      instruction: (instruction as string).trim(),
      events: (events as Array<{ event: string; date?: string; hint?: string }>).map(e => ({
        event: e.event.trim(),
        date: e.date?.trim(),
        hint: e.hint?.trim()
      })),
      correctOrder: correctOrder as number[]
    },
    errors: []
  };
}

/**
 * Validates matching_era (era association) content
 */
export function validateMatchingEra(content: Record<string, unknown>): ValidationResult<MatchingEraContent> {
  const errors: string[] = [];

  const instruction = content.instruction;
  const items = content.items;
  const eras = content.eras;
  const correctPairs = content.correctPairs;

  if (typeof instruction !== 'string' || instruction.trim().length === 0) {
    errors.push('instruction manquante ou vide');
  }

  if (!Array.isArray(items) || items.length < 2) {
    errors.push('items doit être un tableau avec au moins 2 éléments');
  }

  if (!Array.isArray(eras) || eras.length < 2) {
    errors.push('eras doit être un tableau avec au moins 2 époques');
  }

  if (!Array.isArray(correctPairs) || correctPairs.length < 1) {
    errors.push('correctPairs doit être un tableau de paires [[itemIndex, eraIndex], ...]');
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    content: {
      instruction: (instruction as string).trim(),
      items: (items as string[]).map(i => i.trim()),
      eras: (eras as string[]).map(e => e.trim()),
      correctPairs: correctPairs as number[][]
    },
    errors: []
  };
}

/**
 * Validates cause_effect content
 */
export function validateCauseEffect(content: Record<string, unknown>): ValidationResult<CauseEffectContent> {
  const errors: string[] = [];

  const context = content.context;
  const cause = content.cause;
  const possibleEffects = content.possibleEffects;
  const correctIndex = content.correctIndex;
  const explanation = content.explanation;

  if (typeof context !== 'string' || context.trim().length === 0) {
    errors.push('context manquant ou vide');
  }

  if (typeof cause !== 'string' || cause.trim().length === 0) {
    errors.push('cause manquante ou vide');
  }

  if (!Array.isArray(possibleEffects) || possibleEffects.length < 2) {
    errors.push('possibleEffects doit être un tableau avec au moins 2 éléments');
  }

  if (typeof correctIndex !== 'number' || correctIndex < 0) {
    errors.push('correctIndex doit être un nombre positif');
  }

  if (typeof explanation !== 'string') {
    errors.push('explanation manquante');
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    content: {
      context: (context as string).trim(),
      cause: (cause as string).trim(),
      possibleEffects: (possibleEffects as string[]).map(e => e.trim()),
      correctIndex: correctIndex as number,
      explanation: ((explanation as string) ?? '').trim()
    },
    errors: []
  };
}
