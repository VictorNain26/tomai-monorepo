import { describe, expect, it } from 'bun:test';
import type { NormalizedGrade } from '../services/pronote/provider.types';

describe('PronoteProvider port', () => {
  it('NormalizedGrade carries source-agnostic fields', () => {
    const g: NormalizedGrade = {
      subject: 'Mathématiques', value: 15, scale: 20, date: '2026-06-01', comment: null,
    };
    expect(g.scale).toBe(20);
  });

});
