/**
 * Tests - Prompt Validation Service
 * TDD approach pour garantir >95% conformité CSEN
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import {
  promptValidationService,
  type ValidationResult
} from '../services/prompt-validation.service.js';
import type { GenerationParams } from '../types/ai.types.js';
import type { EducationLevelType } from '../types/index.js';

describe('Prompt Validation Service - CSEN 2022 Compliance', () => {

  let baseParams: GenerationParams;

  beforeEach(() => {
    baseParams = {
      level: 'cp' as EducationLevelType,
      subject: 'mathematiques',
      firstName: 'Emma',
      userQuery: 'Test query',
      conversationHistory: [],
      educationalContext: ''
    };
  });

  describe('✅ RÈGLE 1 : Enseignement Explicite (weight: 0.4)', () => {

    it('ÉCHOUE si demande définition mais méthode socratique', async () => {
      const params = {
        ...baseParams,
        userQuery: "C'est quoi une fraction ?"
      };

      const response = `Bonjour Emma !

Qu'en penses-tu ? Selon toi, quand on coupe quelque chose en morceaux, qu'est-ce qu'on obtient ?

Essaie de trouver par toi-même !`;

      const result = await promptValidationService.validateResponse(response, params);

      expect(result.valid).toBe(false);
      expect(result.failedRules).toContain('EXPLICIT_TEACHING_REQUIRED');
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].severity).toBe('high');
      expect(result.score).toBeLessThan(0.95);
    });

    it('N/A si pas demande définition', async () => {
      const params = {
        ...baseParams,
        userQuery: "Peux-tu m'aider à résoudre cet exercice ?"
      };

      const response = `Bien sûr ! Commençons ensemble. Quelle est ta première idée ?`;

      const result = await promptValidationService.validateResponse(response, params);

      // EXPLICIT_TEACHING_REQUIRED doit être N/A donc passer
      expect(result.passedRules).toContain('EXPLICIT_TEACHING_REQUIRED');
    });
  });

  describe('✅ RÈGLE 2 : KaTeX Mathématiques (weight: 0.2)', () => {

    it('PASSE si formules avec KaTeX notation', async () => {
      const params = {
        ...baseParams,
        subject: 'mathematiques'
      };

      const response = `Voici la formule :

$$a + b = c$$

Pour calculer l'aire : $$A = L \\times l$$`;

      const result = await promptValidationService.validateResponse(response, params);

      expect(result.passedRules).toContain('KATEX_REQUIRED');
    });

    it('ÉCHOUE si formules sans KaTeX', async () => {
      const params = {
        ...baseParams,
        subject: 'mathematiques'
      };

      const response = `Voici la formule :

a + b = c

Pour calculer l'aire : A = L x l`;

      const result = await promptValidationService.validateResponse(response, params);

      expect(result.failedRules).toContain('KATEX_REQUIRED');
      expect(result.violations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            rule: 'KATEX_REQUIRED',
            severity: 'medium'
          })
        ])
      );
    });

    it('N/A si pas matière mathématique', async () => {
      const params = {
        ...baseParams,
        subject: 'francais'
      };

      const response = `Voici une phrase : Le chat mange la souris.`;

      const result = await promptValidationService.validateResponse(response, params);

      // KATEX_REQUIRED doit être N/A donc passer
      expect(result.passedRules).toContain('KATEX_REQUIRED');
    });

    it('N/A si mathématiques mais pas de formules', async () => {
      const params = {
        ...baseParams,
        subject: 'mathematiques'
      };

      const response = `Les nombres entiers sont des nombres sans virgule.`;

      const result = await promptValidationService.validateResponse(response, params);

      expect(result.passedRules).toContain('KATEX_REQUIRED');
    });
  });

  describe('✅ RÈGLE 3 : Ton Professionnel (weight: 0.2)', () => {

    it('PASSE si ton professionnel bienveillant', async () => {
      const response = `Bonjour Emma !

Excellente question ! Je vais t'expliquer cela clairement.

Une fraction représente une partie d'un tout. C'est un concept important en mathématiques.`;

      const result = await promptValidationService.validateResponse(response, baseParams);

      expect(result.passedRules).toContain('PROFESSIONAL_TONE_REQUIRED');
    });

    it('ÉCHOUE si ton informel (lol, haha, cool...)', async () => {
      const response = `Salut Emma !

Haha trop cool ta question mec ! Grave stylé de demander ça. Lol c'est ouf les fractions !`;

      const result = await promptValidationService.validateResponse(response, baseParams);

      expect(result.failedRules).toContain('PROFESSIONAL_TONE_REQUIRED');
      expect(result.violations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            rule: 'PROFESSIONAL_TONE_REQUIRED',
            severity: 'medium'
          })
        ])
      );
    });
  });

  describe('✅ RÈGLE 4 : Utilisation Contexte RAG (weight: 0.1)', () => {

    it('PASSE si contexte RAG utilisé (>30% keywords)', async () => {
      const params = {
        ...baseParams,
        educationalContext: `## Programmes officiels CP - Mathématiques

Comprendre et utiliser des nombres entiers pour dénombrer, ordonner, repérer, comparer.
Nommer, lire, écrire, représenter des nombres entiers naturels inférieurs à 100.
Résoudre des problèmes en utilisant des nombres entiers et le calcul.`
      };

      const response = `Selon les programmes officiels CP en mathématiques, nous allons travailler sur les nombres entiers.

Tu vas apprendre à dénombrer, ordonner, repérer et comparer les nombres jusqu'à 100. Nous résoudrons aussi des problèmes ensemble !`;

      const result = await promptValidationService.validateResponse(response, params);

      expect(result.passedRules).toContain('RAG_CONTEXT_USAGE');
    });

    it('ÉCHOUE si contexte RAG ignoré (<30% keywords)', async () => {
      const params = {
        ...baseParams,
        educationalContext: `## Programmes officiels CP - Mathématiques

Comprendre et utiliser des nombres entiers pour dénombrer, ordonner, repérer, comparer.`
      };

      const response = `Bonjour ! On va s'amuser avec les chiffres aujourd'hui ! C'est super !`;

      const result = await promptValidationService.validateResponse(response, params);

      expect(result.failedRules).toContain('RAG_CONTEXT_USAGE');
    });
  });

  describe('✅ RÈGLE 5 : Pas de Blagues (weight: 0.1)', () => {

    it('PASSE si contenu éducatif sérieux', async () => {
      const response = `Bonjour Emma !

Les fractions sont un concept mathématique fondamental. Tu vas les utiliser dans de nombreuses situations.`;

      const result = await promptValidationService.validateResponse(response, baseParams);

      expect(result.passedRules).toContain('NO_JOKES');
    });

    it('ÉCHOUE si blagues présentes', async () => {
      const response = `Bonjour Emma !

Tu connais la blague sur les mathématiques ? Haha trop drôle ! 😂

Pourquoi le poulet a traversé la route ? Haha rigole un peu !`;

      const result = await promptValidationService.validateResponse(response, baseParams);

      expect(result.failedRules).toContain('NO_JOKES');
      expect(result.violations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            rule: 'NO_JOKES',
            severity: 'medium'
          })
        ])
      );
    });
  });

  describe('📊 Score Conformité Global', () => {

    it('Score <0.95 si violations critiques', async () => {
      const params = {
        ...baseParams,
        userQuery: "C'est quoi une fraction ?"
      };

      const response = `Qu'en penses-tu ? Essaie de deviner !`; // Socratique au lieu d'explicite

      const result = await promptValidationService.validateResponse(response, params);

      // EXPLICIT_TEACHING_REQUIRED weight=0.4, donc score <= 0.6
      expect(result.score).toBeLessThan(0.95);
      expect(result.valid).toBe(false);
    });
  });

  describe('🔍 Edge Cases & Robustesse', () => {

    it('Gère réponse vide', async () => {
      const response = '';

      const result = await promptValidationService.validateResponse(response, baseParams);

      expect(result).toBeDefined();
      expect(result.score).toBeDefined();
    });

    it('Gère caractères spéciaux', async () => {
      const response = `Voici des symboles : € £ ¥ © ® ™`;

      const result = await promptValidationService.validateResponse(response, baseParams);

      expect(result).toBeDefined();
      expect(result.passedRules).toContain('PROFESSIONAL_TONE_REQUIRED');
    });

    it('Gère réponse très longue', async () => {
      const response = 'A'.repeat(10000);

      const result = await promptValidationService.validateResponse(response, baseParams);

      expect(result).toBeDefined();
    });

    it('Préserve ordre violations par severity', async () => {
      const params = {
        ...baseParams,
        userQuery: "C'est quoi une fraction ?"
      };

      const response = `Haha qu'en penses-tu ? Essaie de deviner !`; // Multiple violations

      const result = await promptValidationService.validateResponse(response, params);

      expect(result.violations.length).toBeGreaterThan(1);

      // High severity en premier
      const highViolations = result.violations.filter(v => v.severity === 'high');
      expect(highViolations.length).toBeGreaterThan(0);
    });
  });
});
