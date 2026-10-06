import { describe, it, expect } from 'bun:test';
import { routeReasoningEffort } from '../modules/tutor/mistral-reasoning.js';
import { SUBJECT_FAMILIES } from '../lib/subjects.js';
import { analysis } from './_helpers/turn-analysis';

describe('routeReasoningEffort', () => {
  it('reasons on a request for the solution or an explanation in STEM, from the 4e', () => {
    for (const subject of ['mathematiques', 'sciences'] as const) {
      expect(SUBJECT_FAMILIES).toContain(subject);
      expect(routeReasoningEffort({ schoolLevel: 'troisieme', subject, analysis: analysis({ asksSolution: true }) })).toBe('high');
      expect(routeReasoningEffort({ schoolLevel: 'quatrieme', subject, analysis: analysis({ asksExplanation: true }) })).toBe('high');
    }
  });

  it('does not reason outside STEM, below the 4e, or without a request', () => {
    for (const subject of ['francais', 'langues', 'histoire-geo', 'general'] as const) {
      expect(routeReasoningEffort({ schoolLevel: 'troisieme', subject, analysis: analysis({ asksExplanation: true }) })).toBe('none');
    }
    expect(routeReasoningEffort({ schoolLevel: 'cinquieme', subject: 'sciences', analysis: analysis({ asksSolution: true }) })).toBe('none');
    expect(routeReasoningEffort({ schoolLevel: 'troisieme', subject: 'sciences', analysis: analysis() })).toBe('none');
    expect(routeReasoningEffort({ schoolLevel: 'troisieme', subject: 'sciences' })).toBe('none');
    expect(routeReasoningEffort({ schoolLevel: 'troisieme', analysis: analysis({ asksSolution: true }) })).toBe('none');
  });

  it('writes without reasoning under a contract: the sheet and the diagnosis carry the exactness', () => {
    expect(
      routeReasoningEffort({
        schoolLevel: 'troisieme',
        subject: 'mathematiques',
        analysis: analysis({ proposesAnswer: true, asksSolution: true }),
        contracted: true,
      }),
    ).toBe('none');
  });

  it('reasons on a proposed answer without a contract, whatever the level and subject: the verdict must be right', () => {
    for (const subject of ['francais', 'langues', 'mathematiques'] as const) {
      expect(routeReasoningEffort({ schoolLevel: 'sixieme', subject, analysis: analysis({ proposesAnswer: true }) })).toBe('high');
    }
  });
});
