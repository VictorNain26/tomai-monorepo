/**
 * Card Parser Types
 *
 * Interfaces used by card validation functions.
 */

import type { ParsedCard } from '../types.js';

export interface ParseResult {
  success: boolean;
  cards: ParsedCard[];
  errors: string[];
  rawResponse?: string;
}

export interface ValidationResult<T> {
  success: boolean;
  content?: T;
  errors: string[];
}
