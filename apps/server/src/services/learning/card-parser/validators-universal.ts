/**
 * Universal Card Validators
 *
 * Validators for core card types used across all subjects:
 * - flashcard
 * - qcm (multiple choice)
 * - vrai_faux (true/false)
 */

import type {
  FlashcardContent,
  QCMContent,
  VraiFauxContent,
} from '../types.js';
import type { ValidationResult } from './types.js';

/**
 * Validates flashcard content
 */
export function validateFlashcard(content: Record<string, unknown>): ValidationResult<FlashcardContent> {
  const errors: string[] = [];

  const front = content.front;
  const back = content.back;

  if (typeof front !== 'string' || front.trim().length === 0) {
    errors.push('front manquant ou vide');
  }

  if (typeof back !== 'string' || back.trim().length === 0) {
    errors.push('back manquant ou vide');
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    content: {
      front: (front as string).trim(),
      back: (back as string).trim()
    },
    errors: []
  };
}

/**
 * Validates QCM (multiple choice) content
 */
export function validateQCM(content: Record<string, unknown>): ValidationResult<QCMContent> {
  const errors: string[] = [];

  const question = content.question;
  const options = content.options;
  const correctIndex = content.correctIndex;
  const explanation = content.explanation;

  if (typeof question !== 'string' || question.trim().length === 0) {
    errors.push('question manquante ou vide');
  }

  if (!Array.isArray(options) || options.length < 2) {
    errors.push('options doit être un tableau avec au moins 2 éléments');
  } else {
    for (let i = 0; i < options.length; i++) {
      if (typeof options[i] !== 'string' || (options[i] as string).trim().length === 0) {
        errors.push(`option ${i + 1} invalide ou vide`);
      }
    }
  }

  if (typeof correctIndex !== 'number' || correctIndex < 0) {
    errors.push('correctIndex doit être un nombre positif');
  } else if (Array.isArray(options) && correctIndex >= options.length) {
    errors.push(`correctIndex (${correctIndex}) dépasse le nombre d'options (${options.length})`);
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
      question: (question as string).trim(),
      options: (options as string[]).map(o => o.trim()),
      correctIndex: correctIndex as number,
      explanation: ((explanation as string) ?? '').trim()
    },
    errors: []
  };
}

/**
 * Validates Vrai/Faux (true/false) content
 */
export function validateVraiFaux(content: Record<string, unknown>): ValidationResult<VraiFauxContent> {
  const errors: string[] = [];

  const statement = content.statement;
  const isTrue = content.isTrue;
  const explanation = content.explanation;

  if (typeof statement !== 'string' || statement.trim().length === 0) {
    errors.push('statement manquant ou vide');
  }

  if (typeof isTrue !== 'boolean') {
    errors.push('isTrue doit être un booléen (true ou false)');
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
      statement: (statement as string).trim(),
      isTrue: isTrue as boolean,
      explanation: ((explanation as string) ?? '').trim()
    },
    errors: []
  };
}
