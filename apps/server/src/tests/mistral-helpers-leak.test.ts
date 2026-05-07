/**
 * Tests unitaires — System-prompt leak detector
 * (services/chat/mistral-helpers.ts → detectSystemPromptLeak).
 *
 * Defense layer 3 (CCA D4 §10): the model is instructed never to reveal its
 * system prompt; this regex runs over accumulated stream content and trips
 * if any of the structural XML tags from our prompt template appears in the
 * assistant output.
 *
 * Pure regex check — no mocks needed.
 *
 * Note on contract scope: the regex in mistral-helpers.ts targets the
 * specific tags currently used by our prompt builder. Tags that are NOT
 * in our prompt template (e.g. `<level_adaptation>`, `<subject_specifics>`)
 * are intentionally NOT matched, because adding them would risk false
 * positives on legitimate pedagogical content. The list below is the
 * authoritative contract; any new tag introduced by the prompt builder
 * MUST be added to both the regex and this test in the same PR.
 */

import { describe, it, expect } from 'bun:test';
import { detectSystemPromptLeak } from '../services/chat/mistral-helpers';

describe('detectSystemPromptLeak()', () => {
  it('returns null on empty input', () => {
    expect(detectSystemPromptLeak('')).toBeNull();
  });

  it('returns null on benign tutor reply with no tags', () => {
    const text =
      "Bonjour ! Pour résoudre 3x + 5 = 14, commence par isoler le terme en x. " +
      "Que peux-tu soustraire des deux côtés pour faire disparaître le +5 ?";
    expect(detectSystemPromptLeak(text)).toBeNull();
  });

  describe('detects each protected marker (opening tag)', () => {
    const markers = [
      'role',
      'safety',
      'rag_policy',
      'pedagogy',
      'student_message',
      'student',
      'past_sessions',
      'critical_instruction',
      'transparency',
      'tone',
    ] as const;

    for (const tag of markers) {
      it(`flags <${tag}> as a leak`, () => {
        const out = detectSystemPromptLeak(`leading text <${tag}> trailing`);
        expect(out).not.toBeNull();
        expect(out?.toLowerCase()).toBe(`<${tag}>`);
      });

      it(`flags </${tag}> (closing tag) as a leak`, () => {
        const out = detectSystemPromptLeak(`text </${tag}> more`);
        expect(out).not.toBeNull();
        expect(out?.toLowerCase()).toBe(`</${tag}>`);
      });
    }
  });

  describe('case-insensitive matching', () => {
    it('flags mixed-case <Role>', () => {
      const out = detectSystemPromptLeak('Voici le <Role> de Tom...');
      expect(out).toBe('<Role>');
    });

    it('flags upper-case <SAFETY>', () => {
      const out = detectSystemPromptLeak('<SAFETY>');
      expect(out).toBe('<SAFETY>');
    });

    it('flags mixed-case </Pedagogy>', () => {
      const out = detectSystemPromptLeak('text </Pedagogy>');
      expect(out).toBe('</Pedagogy>');
    });
  });

  it('finds a marker buried in a long pedagogical paragraph', () => {
    const longText =
      "Excellent travail ! Continue d'analyser le problème en posant " +
      "les hypothèses une à une. Pour la prochaine étape, vérifie que " +
      "tu as bien identifié toutes les variables. <pedagogy>strategy: " +
      "socratic</pedagogy> Enfin, applique la méthode en remplaçant " +
      "chaque variable par sa valeur numérique et conclus.";
    const out = detectSystemPromptLeak(longText);
    expect(out).toBe('<pedagogy>');
  });

  describe('does NOT flag legitimate content with angle brackets', () => {
    it('returns null for a math inequality "5 < 10"', () => {
      expect(detectSystemPromptLeak('On a bien 5 < 10, donc x est positif.')).toBeNull();
    });

    it('returns null for HTML-like text without protected tag names', () => {
      expect(detectSystemPromptLeak('<div>example</div>')).toBeNull();
    });

    it('returns null for a comparison chain "a < b > c"', () => {
      expect(detectSystemPromptLeak('Si a < b > c alors b est le plus grand.')).toBeNull();
    });

    it('returns null for an unknown XML-like tag', () => {
      // Detector is tag-name-specific; arbitrary XML must not trip it.
      expect(detectSystemPromptLeak('Considérons <foobar> et </foobar>.')).toBeNull();
    });

    it('returns null for an unknown XML-like tag (foobar)', () => {
      expect(detectSystemPromptLeak('Considérons <foobar> et </foobar>.')).toBeNull();
    });

    it('returns null for unrelated XML (item, section)', () => {
      expect(detectSystemPromptLeak('<item>a</item><section>b</section>')).toBeNull();
    });
  });

  describe('covers all prompt-template markers', () => {
    // If a new XML tag is introduced in apps/server/src/config/prompts/**,
    // it MUST be added to the regex AND to this test in the same PR. Each
    // case here pins the contract scope.
    it('flags <level_adaptation> (emitted by adaptation/by-level.ts)', () => {
      expect(detectSystemPromptLeak('<level_adaptation>cm2</level_adaptation>')).toBe(
        '<level_adaptation>',
      );
    });

    it('flags <subject_specifics> (emitted by adaptation/by-subject.ts)', () => {
      expect(detectSystemPromptLeak('<subject_specifics>math</subject_specifics>')).toBe(
        '<subject_specifics>',
      );
    });
  });
});
