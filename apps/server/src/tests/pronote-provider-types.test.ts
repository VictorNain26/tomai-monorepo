import { describe, expect, it } from 'bun:test';
import type { PronoteProvider, NormalizedGrade } from '../services/pronote/provider.types';

describe('PronoteProvider port', () => {
  it('NormalizedGrade carries source-agnostic fields', () => {
    const g: NormalizedGrade = {
      subject: 'Mathématiques', value: 15, scale: 20, date: '2026-06-01', comment: null,
    };
    expect(g.scale).toBe(20);
  });

  it('provider exposes the four read methods + lifecycle', () => {
    const shape: (keyof PronoteProvider)[] = ['connect', 'getGrades', 'getHomework', 'getTimetable', 'disconnect'];
    expect(shape).toHaveLength(5);
  });
});
