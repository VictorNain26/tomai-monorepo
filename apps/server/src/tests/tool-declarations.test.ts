/**
 * Tests anti-régression — tool-declarations.ts
 *
 * Vérifie que les outils exposent un enum non vide sur le champ subject,
 * et que les contraintes numériques sont présentes.
 * Entièrement déterministe (zéro mock réseau).
 */

import { describe, it, expect } from 'bun:test';
import { agentTools, SUBJECT_SLUGS } from '../services/chat/tool-declarations';

describe('SUBJECT_SLUGS', () => {
  it('exporte 13 slugs non vides', () => {
    expect(SUBJECT_SLUGS.length).toBe(13);
    for (const slug of SUBJECT_SLUGS) {
      expect(slug.length).toBeGreaterThan(0);
    }
  });
});

describe('generate_flashcards', () => {
  const tool = agentTools.find(t => t.function.name === 'generate_flashcards');

  it('existe dans agentTools', () => {
    expect(tool).toBeDefined();
  });

  it('subject expose un enum identique à SUBJECT_SLUGS', () => {
    const props = tool!.function.parameters.properties as Record<string, unknown>;
    const subjectProp = props['subject'] as { enum?: unknown[] };
    expect(Array.isArray(subjectProp.enum)).toBe(true);
    expect(subjectProp.enum!.length).toBe(SUBJECT_SLUGS.length);
    expect(subjectProp.enum).toEqual([...SUBJECT_SLUGS]);
  });

  it('cardCount a minimum:3 et maximum:10', () => {
    const props = tool!.function.parameters.properties as Record<string, unknown>;
    const cardCountProp = props['cardCount'] as { minimum?: number; maximum?: number };
    expect(cardCountProp.minimum).toBe(3);
    expect(cardCountProp.maximum).toBe(10);
  });
});

describe('update_student_profile', () => {
  const tool = agentTools.find(t => t.function.name === 'update_student_profile');

  it('subject ne porte pas d\'enum (observation libre)', () => {
    const props = tool!.function.parameters.properties as Record<string, unknown>;
    const subjectProp = props['subject'] as { enum?: unknown[] };
    expect(subjectProp.enum).toBeUndefined();
  });

  it('observation a maxLength:250', () => {
    const props = tool!.function.parameters.properties as Record<string, unknown>;
    const prop = props['observation'] as { maxLength?: number };
    expect(prop.maxLength).toBe(250);
  });

  it('strength a maxLength:100', () => {
    const props = tool!.function.parameters.properties as Record<string, unknown>;
    const prop = props['strength'] as { maxLength?: number };
    expect(prop.maxLength).toBe(100);
  });

  it('weakness a maxLength:100', () => {
    const props = tool!.function.parameters.properties as Record<string, unknown>;
    const prop = props['weakness'] as { maxLength?: number };
    expect(prop.maxLength).toBe(100);
  });
});
