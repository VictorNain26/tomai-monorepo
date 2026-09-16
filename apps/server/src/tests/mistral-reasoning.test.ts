import { describe, it, expect } from 'bun:test';
import { routeReasoningEffort } from '../lib/ai/mistral-reasoning.js';
import { STUDENT_SUBJECTS } from '../config/prompts/adaptation/subjects.js';

describe('routeReasoningEffort', () => {
  it('boosts the subject families the intent classifier emits for STEM', () => {
    for (const subject of ['mathematiques', 'sciences'] as const) {
      expect(STUDENT_SUBJECTS).toContain(subject);
      expect(routeReasoningEffort({ schoolLevel: 'troisieme', subject, intent: 'solve-this-for-me' })).toBe('high');
    }
  });

  it('does not boost non-STEM families', () => {
    for (const subject of ['francais', 'langues', 'histoire-geo', 'general'] as const) {
      expect(routeReasoningEffort({ schoolLevel: 'troisieme', subject, intent: 'explain-concept' })).toBe('none');
    }
  });

  it('requires a college+ level', () => {
    expect(routeReasoningEffort({ schoolLevel: 'cinquieme', subject: 'sciences', intent: 'check-my-answer' })).toBe('none');
  });

  it('requires a hard intent', () => {
    expect(routeReasoningEffort({ schoolLevel: 'seconde', subject: 'sciences', intent: 'chit-chat' })).toBe('none');
    expect(routeReasoningEffort({ schoolLevel: 'seconde', subject: 'sciences' })).toBe('none');
  });

  it('falls back to none without a subject', () => {
    expect(routeReasoningEffort({ schoolLevel: 'terminale', intent: 'solve-this-for-me' })).toBe('none');
  });
});
