/**
 * Pronote Helpers - Shared utilities for grades, homework, and QR onboarding
 *
 * Consolidates duplicate code from student/parent screens and onboarding hooks.
 */

import { bgColors, borderColors } from '@/lib/styles';
import type { ThemeColors } from '@/hooks/useThemeColors';
import type { QrCodeData } from '@/services/pronote/pronote-types';

// ============================================================================
// TYPES
// ============================================================================

interface GradeStyle {
  textColor: string;
  bgColor: string;
  borderColor: string;
}

// ============================================================================
// DATE HELPERS
// ============================================================================

/**
 * Format date for grades display (e.g., "12 janv.")
 */
export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Format date for homework display (e.g., "lun. 12 janv.")
 */
export function formatDateWithDay(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Check if homework is overdue
 */
export function isOverdue(dateStr: string, done: boolean): boolean {
  if (done) return false;
  const dueDate = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return dueDate < today;
}

/**
 * Get days until due date
 */
export function getDaysUntil(dateStr: string): number {
  const dueDate = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);
  return Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// ============================================================================
// GRADE HELPERS
// ============================================================================

/**
 * Get styling for a grade based on its value (inline styles)
 */
export function getGradeStyle(value: number | null, outOf: number, colors: ThemeColors): GradeStyle {
  if (value === null || outOf === 0) {
    return {
      textColor: colors.mutedForeground,
      bgColor: bgColors.muted[50],
      borderColor: borderColors.muted[20],
    };
  }
  const percent = (value / outOf) * 100;
  if (percent >= 80) {
    return {
      textColor: colors.success,
      bgColor: bgColors.success[10],
      borderColor: borderColors.success[30],
    };
  }
  if (percent >= 60) {
    return {
      textColor: colors.primary,
      bgColor: bgColors.primary[10],
      borderColor: borderColors.primary[30],
    };
  }
  if (percent >= 40) {
    return {
      textColor: colors.warning,
      bgColor: bgColors.warning[10],
      borderColor: borderColors.warning[30],
    };
  }
  return {
    textColor: colors.destructive,
    bgColor: bgColors.destructive[10],
    borderColor: borderColors.destructive[30],
  };
}

/**
 * Check if a grade is low (needs review)
 */
export function isLowGrade(value: number | null, outOf: number): boolean {
  if (value === null || outOf === 0) return false;
  return (value / outOf) * 100 < 50;
}

// ============================================================================
// WEEK LABEL HELPER
// ============================================================================

/**
 * Get start/end bounds (Mon-Sun) for a given week offset from current week.
 */
export function getWeekBounds(weekOffset: number): { start: Date; end: Date } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() + diffToMonday + weekOffset * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

/**
 * Get label for week offset
 */
export function getWeekLabel(weekOffset: number): string {
  if (weekOffset === 0) return 'Cette semaine';
  if (weekOffset === 1) return 'Semaine +1';
  if (weekOffset === -1) return 'Semaine -1';
  return `Semaine ${weekOffset > 0 ? '+' : ''}${weekOffset}`;
}

// ============================================================================
// NAME HELPER
// ============================================================================

/**
 * Split a Pronote resource name ("LASTNAME Firstname") into firstName and
 * lastName. Pronote capitalises the last name by convention, so `parts[0]`
 * is the family name and the remainder is the given name(s).
 *
 * Single-token names fall back to using the token as the first name.
 */
export function splitPronoteName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0] ?? fullName, lastName: '' };
  }
  const lastName = parts[0] ?? '';
  const firstName = parts.slice(1).join(' ');
  return { firstName, lastName };
}

/**
 * Build the canonical "LASTNAME Firstname" comparison key used by
 * PronoteChildImport to detect already-imported children.
 */
export function toPronoteDedupeKey(child: { firstName: string; lastName: string }): string {
  return `${child.lastName} ${child.firstName}`.trim();
}

// ============================================================================
// QR CODE HELPERS
// ============================================================================

/**
 * Parse a raw QR code string into a QrCodeData object.
 * Returns null if the payload is not valid JSON or is missing required fields.
 */
export function parseQrCode(data: string): QrCodeData | null {
  try {
    const parsed = JSON.parse(data) as Record<string, unknown>;
    if (
      typeof parsed.jeton === 'string' &&
      typeof parsed.login === 'string' &&
      typeof parsed.url === 'string'
    ) {
      return { jeton: parsed.jeton, login: parsed.login, url: parsed.url };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Extract a human-readable establishment name from a Pronote URL.
 * Uses the first subdomain segment (e.g. "pronote" from "https://pronote.example.fr").
 * Falls back to 'Mon etablissement' when the URL doesn't match.
 */
export function extractEstablishment(url: string): string {
  const match = url.match(/^https?:\/\/([^/:]+)/);
  if (match?.[1]) {
    return match[1].split('.')[0] || 'Mon etablissement';
  }
  return 'Mon etablissement';
}

/**
 * Generate a Pronote username slug from a full name (e.g. "Élodie Bernard" → "elodie.bernard").
 * Lowercases, strips combining diacritics, joins words with dots, removes non-alphanumeric chars.
 * Leading/trailing whitespace is trimmed; no doubled or edge dots in the result.
 */
export function pronoteUsername(name: string): string {
  // Remove combining diacritical marks (U+0300-U+036F) after NFD decomposition.
  const combiningMarks = new RegExp('[\\u0300-\\u036f]', 'g');
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(combiningMarks, '')
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9.]/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+|\.+$/g, '');
}
