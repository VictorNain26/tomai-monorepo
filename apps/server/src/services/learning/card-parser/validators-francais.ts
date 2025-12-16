/**
 * French Card Validators
 *
 * Validators for French language-specific card types:
 * - grammar_transform (grammatical transformations)
 */

import type { GrammarTransformContent } from '../types.js';
import type { ValidationResult } from './types.js';

/**
 * Validates grammar_transform content
 */
export function validateGrammarTransform(content: Record<string, unknown>): ValidationResult<GrammarTransformContent> {
  const errors: string[] = [];

  const instruction = content.instruction;
  const originalSentence = content.originalSentence;
  const transformationType = content.transformationType;
  const correctAnswer = content.correctAnswer;
  const explanation = content.explanation;

  if (typeof instruction !== 'string' || instruction.trim().length === 0) {
    errors.push('instruction manquante ou vide');
  }

  if (typeof originalSentence !== 'string' || originalSentence.trim().length === 0) {
    errors.push('originalSentence manquante ou vide');
  }

  const validTransformTypes = ['tense', 'voice', 'form', 'number'];
  if (typeof transformationType !== 'string' || !validTransformTypes.includes(transformationType)) {
    errors.push(`transformationType doit être: ${validTransformTypes.join(', ')}`);
  }

  if (typeof correctAnswer !== 'string' || correctAnswer.trim().length === 0) {
    errors.push('correctAnswer manquante ou vide');
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
      instruction: (instruction as string).trim(),
      originalSentence: (originalSentence as string).trim(),
      transformationType: transformationType as 'tense' | 'voice' | 'form' | 'number',
      correctAnswer: (correctAnswer as string).trim(),
      acceptableVariants: Array.isArray(content.acceptableVariants)
        ? (content.acceptableVariants as string[]).map(v => v.trim())
        : undefined,
      explanation: ((explanation as string) ?? '').trim()
    },
    errors: []
  };
}
