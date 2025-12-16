/**
 * Language Card Validators
 *
 * Validators for language-specific card types:
 * - matching (pair associations)
 * - fill_blank (fill in the blank)
 * - word_order (sentence construction)
 */

import type {
  MatchingContent,
  FillBlankContent,
  WordOrderContent,
} from '../types.js';
import type { ValidationResult } from './types.js';

/**
 * Validates matching (association) content
 */
export function validateMatching(content: Record<string, unknown>): ValidationResult<MatchingContent> {
  const errors: string[] = [];

  const instruction = content.instruction;
  const pairs = content.pairs;

  if (typeof instruction !== 'string' || instruction.trim().length === 0) {
    errors.push('instruction manquante ou vide');
  }

  if (!Array.isArray(pairs) || pairs.length < 2) {
    errors.push('pairs doit être un tableau avec au moins 2 paires');
  } else {
    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i] as Record<string, unknown>;
      if (!pair || typeof pair.left !== 'string' || typeof pair.right !== 'string') {
        errors.push(`paire ${i + 1} invalide (doit avoir left et right)`);
      }
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    content: {
      instruction: (instruction as string).trim(),
      pairs: (pairs as Array<{ left: string; right: string }>).map(p => ({
        left: p.left.trim(),
        right: p.right.trim()
      }))
    },
    errors: []
  };
}

/**
 * Validates fill_blank (cloze test) content
 */
export function validateFillBlank(content: Record<string, unknown>): ValidationResult<FillBlankContent> {
  const errors: string[] = [];

  const sentence = content.sentence;
  const options = content.options;
  const correctIndex = content.correctIndex;
  const explanation = content.explanation;

  if (typeof sentence !== 'string' || !sentence.includes('___')) {
    errors.push('sentence doit contenir un trou (___) ');
  }

  if (!Array.isArray(options) || options.length < 2) {
    errors.push('options doit être un tableau avec au moins 2 éléments');
  }

  if (typeof correctIndex !== 'number' || correctIndex < 0) {
    errors.push('correctIndex doit être un nombre positif');
  } else if (Array.isArray(options) && correctIndex >= options.length) {
    errors.push(`correctIndex (${correctIndex}) dépasse le nombre d'options`);
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
      sentence: (sentence as string).trim(),
      options: (options as string[]).map(o => o.trim()),
      correctIndex: correctIndex as number,
      grammaticalPoint: typeof content.grammaticalPoint === 'string' ? content.grammaticalPoint.trim() : undefined,
      explanation: ((explanation as string) ?? '').trim()
    },
    errors: []
  };
}

/**
 * Validates word_order (sentence reconstruction) content
 */
export function validateWordOrder(content: Record<string, unknown>): ValidationResult<WordOrderContent> {
  const errors: string[] = [];

  const instruction = content.instruction;
  const words = content.words;
  const correctSentence = content.correctSentence;

  if (typeof instruction !== 'string' || instruction.trim().length === 0) {
    errors.push('instruction manquante ou vide');
  }

  if (!Array.isArray(words) || words.length < 3) {
    errors.push('words doit être un tableau avec au moins 3 mots');
  }

  if (typeof correctSentence !== 'string' || correctSentence.trim().length === 0) {
    errors.push('correctSentence manquante ou vide');
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    content: {
      instruction: (instruction as string).trim(),
      words: (words as string[]).map(w => w.trim()),
      correctSentence: (correctSentence as string).trim(),
      translation: typeof content.translation === 'string' ? content.translation.trim() : undefined
    },
    errors: []
  };
}
