/**
 * Science Card Validators
 *
 * Validators for math and science card types:
 * - calculation (step-by-step math problems)
 * - classification (categorization exercises)
 * - process_order (process sequencing)
 */

import type {
  CalculationContent,
  ClassificationContent,
  ProcessOrderContent,
} from '../types.js';
import type { ValidationResult } from './types.js';

/**
 * Validates calculation (math problem with steps) content
 */
export function validateCalculation(content: Record<string, unknown>): ValidationResult<CalculationContent> {
  const errors: string[] = [];

  const problem = content.problem;
  const steps = content.steps;
  const answer = content.answer;

  if (typeof problem !== 'string' || problem.trim().length === 0) {
    errors.push('problem manquant ou vide');
  }

  if (!Array.isArray(steps) || steps.length < 1) {
    errors.push('steps doit être un tableau avec au moins 1 étape');
  }

  if (typeof answer !== 'string' || answer.trim().length === 0) {
    errors.push('answer manquante ou vide');
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    content: {
      problem: (problem as string).trim(),
      steps: (steps as string[]).map(s => s.trim()),
      answer: (answer as string).trim(),
      hint: typeof content.hint === 'string' ? content.hint.trim() : undefined
    },
    errors: []
  };
}

/**
 * Validates classification content
 */
export function validateClassification(content: Record<string, unknown>): ValidationResult<ClassificationContent> {
  const errors: string[] = [];

  const instruction = content.instruction;
  const items = content.items;
  const categories = content.categories;
  const correctClassification = content.correctClassification;

  if (typeof instruction !== 'string' || instruction.trim().length === 0) {
    errors.push('instruction manquante ou vide');
  }

  if (!Array.isArray(items) || items.length < 2) {
    errors.push('items doit être un tableau avec au moins 2 éléments');
  }

  if (!Array.isArray(categories) || categories.length < 2) {
    errors.push('categories doit être un tableau avec au moins 2 catégories');
  }

  if (!correctClassification || typeof correctClassification !== 'object') {
    errors.push('correctClassification doit être un objet { catégorie: [indices] }');
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    content: {
      instruction: (instruction as string).trim(),
      items: (items as string[]).map(i => i.trim()),
      categories: (categories as string[]).map(c => c.trim()),
      correctClassification: correctClassification as Record<string, number[]>,
      explanation: typeof content.explanation === 'string' ? content.explanation.trim() : undefined
    },
    errors: []
  };
}

/**
 * Validates process_order (process steps sequencing) content
 */
export function validateProcessOrder(content: Record<string, unknown>): ValidationResult<ProcessOrderContent> {
  const errors: string[] = [];

  const instruction = content.instruction;
  const processName = content.processName;
  const steps = content.steps;
  const correctOrder = content.correctOrder;

  if (typeof instruction !== 'string' || instruction.trim().length === 0) {
    errors.push('instruction manquante ou vide');
  }

  if (typeof processName !== 'string' || processName.trim().length === 0) {
    errors.push('processName manquant ou vide');
  }

  if (!Array.isArray(steps) || steps.length < 2) {
    errors.push('steps doit être un tableau avec au moins 2 étapes');
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
      processName: (processName as string).trim(),
      steps: (steps as string[]).map(s => s.trim()),
      correctOrder: correctOrder as number[],
      explanation: typeof content.explanation === 'string' ? content.explanation.trim() : undefined
    },
    errors: []
  };
}
