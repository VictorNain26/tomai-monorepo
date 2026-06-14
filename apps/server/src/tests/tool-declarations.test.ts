/**
 * Tests anti-régression — tool-declarations.ts
 *
 * Vérifie que les outils RAG exposent un enum non vide sur les champs
 * matiere/subject, et que les contraintes numériques sont présentes.
 * Entièrement déterministe (zéro mock réseau).
 */

import { describe, it, expect } from 'bun:test';
import { agentTools, RAG_SUBJECTS } from '../services/chat/tool-declarations';

describe('RAG_SUBJECTS', () => {
  it('exporte 13 slugs non vides', () => {
    expect(RAG_SUBJECTS.length).toBe(13);
    for (const slug of RAG_SUBJECTS) {
      expect(slug.length).toBeGreaterThan(0);
    }
  });
});

describe('search_educational_content', () => {
  const tool = agentTools.find(t => t.function.name === 'search_educational_content');

  it('existe dans agentTools', () => {
    expect(tool).toBeDefined();
  });

  it('matiere expose un enum identique à RAG_SUBJECTS', () => {
    const props = tool!.function.parameters.properties as Record<string, unknown>;
    const matiereProp = props['matiere'] as { enum?: unknown[] };
    expect(Array.isArray(matiereProp.enum)).toBe(true);
    expect(matiereProp.enum!.length).toBe(RAG_SUBJECTS.length);
    expect(matiereProp.enum).toEqual([...RAG_SUBJECTS]);
  });
});

describe('generate_flashcards', () => {
  const tool = agentTools.find(t => t.function.name === 'generate_flashcards');

  it('existe dans agentTools', () => {
    expect(tool).toBeDefined();
  });

  it('subject expose un enum identique à RAG_SUBJECTS', () => {
    const props = tool!.function.parameters.properties as Record<string, unknown>;
    const subjectProp = props['subject'] as { enum?: unknown[] };
    expect(Array.isArray(subjectProp.enum)).toBe(true);
    expect(subjectProp.enum!.length).toBe(RAG_SUBJECTS.length);
    expect(subjectProp.enum).toEqual([...RAG_SUBJECTS]);
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
