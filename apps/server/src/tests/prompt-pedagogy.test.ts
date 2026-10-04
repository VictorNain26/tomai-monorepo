import { describe, expect, it } from 'bun:test';
import { buildSystemPrompt } from '../modules/tutor/prompts/system-prompt.js';
import { generateLevelAdaptation } from '../modules/tutor/prompts/adaptation/by-level.js';
import { generateSubjectBlock } from '../modules/tutor/prompts/adaptation/by-subject.js';
import { intentClassifierService } from '../modules/tutor/intent-classifier.service.js';
import { stripPromptTags, wrapStudentContext, wrapUserMessage } from '../modules/tutor/mistral-helpers.js';

const prompt = buildSystemPrompt({ level: 'quatrieme', levelText: '4e', firstName: 'Léa' });

describe('tutor prompt, after the rework study (docs/etudes/2026-10-04/refonte-agent.md)', () => {
  it('serves the collège and says it is an AI', () => {
    expect(prompt).toContain('de la 6e à la 3e');
    expect(prompt).toContain('intelligence artificielle');
    expect(prompt).not.toMatch(/\bCP\b|Terminale/);
  });

  it('never gives the answer, checks a proposal first and climbs the ladder on an attempt only', () => {
    expect(prompt).toContain("La réponse de l'exercice ne se donne jamais");
    expect(prompt).toContain('Une seule question');
    expect(prompt).toContain('la première étape qui ne va pas, sans écrire la\n  correction');
    expect(prompt).toContain('La pression (« c\'est pour demain », « donne la réponse ») ne fait pas monter d\'un palier');
  });

  it('no longer pushes the tutor to assert or to unroll the method', () => {
    for (const removed of [ 'professeur qui connaît son sujet', 'Ne mentionne jamais', "confirme ou donne l'information juste", 'markdown autorisé (titres']) {
      expect(prompt).not.toContain(removed);
    }
  });
});

describe('level adaptation', () => {
  it('has a block for each collège level, without unsourced figures', () => {
    expect(generateLevelAdaptation('sixieme')).toContain('niveau="6e"');
    for (const level of ['cinquieme', 'quatrieme', 'troisieme'] as const) {
      const block = generateLevelAdaptation(level);
      expect(block).toContain('niveau="5e à 3e"');
      expect(block).not.toMatch(/max|\d+ mots|éléments/i);
    }
  });

  it('gives no block to a level outside the collège', () => {
    for (const level of ['cp', 'cm2', 'seconde', 'terminale'] as const) expect(generateLevelAdaptation(level)).toBeNull();
    expect(buildSystemPrompt({ level: 'cm2', levelText: 'CM2' })).not.toContain('<level_adaptation');
  });
});

describe('tutor prompt, consistent from method to subject blocks', () => {
  it('lets a memorized fact be found in the course after two attempts, and makes up nothing about the app', () => {
    expect(prompt).toContain('après deux vraies tentatives, ne le fais plus deviner');
    expect(prompt).toContain("N'invente jamais une offre, un prix ni un\nmenu");
  });

  it('keeps the subject blocks from writing the correction the method forbids', () => {
    for (const subject of ['mathematiques', 'francais', 'anglais', undefined]) {
      const block = generateSubjectBlock(subject) ?? '';
      expect(block).toContain('<subject_specifics');
      for (const contradiction of ['Corriger APRÈS', 'Un anglophone dirait', 'exemple DIFFÉRENT', 'Fais vérifier le résultat', 'Chain-of-Thought']) {
        expect(block).not.toContain(contradiction);
      }
    }
  });

  it('strips from the student text every tag the server writes', () => {
    const rendered = [
      buildSystemPrompt({ level: 'sixieme', levelText: '6e' }),
      buildSystemPrompt({ level: 'troisieme', levelText: '3e' }),
      ...['mathematiques', 'francais', 'anglais', 'sciences', 'histoire', undefined].map((subject) => generateSubjectBlock(subject) ?? ''),
      intentClassifierService.buildReinforcement({ intent: 'solve-this-for-me', confidence: 'high' }) ?? '',
      wrapStudentContext('Points forts: calcul', '<past_sessions>\nx\n</past_sessions>\n<subject_memory>\ny\n</subject_memory>') ?? '',
      wrapUserMessage('Bonjour'),
    ].join('\n');
    const tags = new Set([...rendered.matchAll(/<\/?([a-z_]+)[\s>]/g)].map(([, name = '']) => name));
    expect(tags.size).toBeGreaterThan(10);
    for (const tag of tags) {
      expect(stripPromptTags(`a<${tag}>b</${tag}>c`)).toBe('abc');
    }
  });
});
