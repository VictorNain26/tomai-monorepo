import { describe, expect, it } from 'bun:test';
import { buildSystemPrompt } from '../modules/tutor/prompts/system-prompt.js';
import { generateLevelAdaptation } from '../modules/tutor/prompts/adaptation/by-level.js';

const prompt = buildSystemPrompt({ level: 'quatrieme', levelText: '4e', subject: 'mathematiques', firstName: 'Léa' });

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
    for (const removed of ['Chain-of-Thought', 'professeur qui connaît son sujet', 'Ne mentionne jamais', "confirme ou donne l'information juste", 'markdown autorisé (titres']) {
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
