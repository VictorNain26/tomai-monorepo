/**
 * Shared formatting utilities for the mobile app.
 */

import type { PronoteGrade } from '@/services/pronote/pronote-types';

export function formatStudyTime(minutes: number): string {
  if (minutes === 0) return '0min';
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h${String(mins).padStart(2, '0')}` : `${hours}h`;
}

export function computeAverageGrade(grades: PronoteGrade[]): number | null {
  const valid = grades.filter(
    (g): g is PronoteGrade & { value: number } => g.value !== null && g.outOf > 0
  );
  if (valid.length === 0) return null;
  const normalized = valid.map((g) => (g.value / g.outOf) * 20);
  return normalized.reduce((sum, v) => sum + v, 0) / normalized.length;
}

export function formatFrenchDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}
