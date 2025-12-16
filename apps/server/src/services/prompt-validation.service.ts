/**
 * Prompt Validation Service - Validation Post-Génération AI
 * Garantit conformité CSEN 2022 + qualité pédagogique
 *
 * Basé sur recherches CSEN 2022 :
 * - Enseignement explicite pour définitions
 * - Méthode socratique uniquement pour exercices
 * - Ton professionnel et bienveillant
 *
 * Objectif : >95% conformité réponses AI
 */

import type { GenerationParams } from '../types/ai.types.js';
import { logger } from '../lib/observability.js';

// ===================================================
// TYPES
// ===================================================

export interface Violation {
  rule: string;
  severity: 'high' | 'medium' | 'low';
  evidence: string;
  suggestion: string;
}

export interface ValidationResult {
  valid: boolean;
  violations: Violation[];
  score: number; // 0-1
  passedRules: string[];
  failedRules: string[];
}

// ===================================================
// CONFIGURATION RÈGLES
// ===================================================

interface ValidationRule {
  weight: number;
  check: (response: string, params: GenerationParams) => boolean;
}

type ValidationRules = Record<string, ValidationRule>;

// ===================================================
// SERVICE
// ===================================================

export class PromptValidationService {
  // Poids calibrés pour total = 1.0
  // RAG est prioritaire (35%) car source de vérité obligatoire
  private readonly VALIDATION_RULES: ValidationRules = {
    // RÈGLE 1 : Enseignement explicite pour définitions (CSEN 2022)
    EXPLICIT_TEACHING_REQUIRED: {
      weight: 0.30, // Réduit de 0.4 pour faire place au RAG
      check: (response: string, params: GenerationParams) => {
        if (this.isDefinitionRequest(params.userQuery)) {
          return this.hasExplicitTeaching(response);
        }
        return true; // N/A si pas demande définition
      }
    },

    // RÈGLE 2 : KaTeX pour mathématiques (standard TomAI)
    KATEX_REQUIRED: {
      weight: 0.15, // Réduit de 0.2
      check: (response: string, params: GenerationParams) => {
        if (this.isMathSubject(params.subject) && this.hasFormulas(response)) {
          return this.hasKaTeX(response);
        }
        return true;
      }
    },

    // RÈGLE 3 : Ton professionnel bienveillant (CSEN 2022)
    PROFESSIONAL_TONE_REQUIRED: {
      weight: 0.15, // Réduit de 0.2
      check: (response: string) => {
        return !this.hasInformalTone(response);
      }
    },

    // RÈGLE 4 : Utilisation contexte RAG (CRITIQUE - source de vérité)
    // SÉCURITÉ: RAG est OBLIGATOIRE - Gemini ne doit JAMAIS inventer
    RAG_CONTEXT_USAGE: {
      weight: 0.35, // Poids élevé - RAG est source de vérité
      check: (response: string, params: GenerationParams) => {
        // Si contexte RAG disponible → vérifier qu'il est utilisé
        if (params.educationalContext && params.educationalContext.length > 100) {
          return this.usesRAGContext(response, params.educationalContext);
        }
        // Si PAS de contexte RAG → la réponse doit contenir le guard-rail
        // (refus de répondre sans source officielle)
        const hasGuardRailResponse = response.toLowerCase().includes('programme officiel')
          || response.toLowerCase().includes('reformuler')
          || response.toLowerCase().includes('plus de détails');
        return hasGuardRailResponse;
      }
    },

    // RÈGLE 5 : Pas de blagues (professionnalisme)
    NO_JOKES: {
      weight: 0.05, // Réduit de 0.1
      check: (response: string) => {
        return !this.containsJokes(response);
      }
    }
  };

  /**
   * Validation complète réponse AI
   * Retourne score conformité + violations détaillées
   */
  async validateResponse(
    response: string,
    params: GenerationParams
  ): Promise<ValidationResult> {
    const violations: Violation[] = [];
    const passedRules: string[] = [];
    const failedRules: string[] = [];

    // Exécuter toutes les règles
    for (const [ruleName, ruleConfig] of Object.entries(this.VALIDATION_RULES)) {
      const passed = ruleConfig.check(response, params);

      if (passed) {
        passedRules.push(ruleName);
      } else {
        failedRules.push(ruleName);
        violations.push(this.createViolation(ruleName, response, params));
      }
    }

    // Calculer score (pondéré par weights)
    const score = this.calculateComplianceScore(passedRules);

    const result: ValidationResult = {
      valid: violations.length === 0,
      violations,
      score,
      passedRules,
      failedRules
    };

    // Logging
    logger.info('AI response validated', {
      operation: 'validation:post-generation',
      valid: result.valid,
      score: result.score,
      violationsCount: violations.length,
      level: params.level,
      subject: params.subject,
      passedRules: passedRules.length,
      failedRules: failedRules.length
    });

    return result;
  }

  // ===================================================
  // DÉTECTEURS PATTERNS
  // ===================================================

  /**
   * Détection demande définition
   * CSEN 2022 : Requiert enseignement explicite
   */
  private isDefinitionRequest(query: string): boolean {
    const definitionTriggers = [
      /c'est quoi/i,
      /qu'est-ce que/i,
      /qu'est ce que/i,
      /explique.?moi/i,
      /défini/i,
      /définition/i,
      /je ne sais pas/i,
      /je comprends? pas/i,
      /peux.?tu m'expliquer/i
    ];

    return definitionTriggers.some(pattern => pattern.test(query));
  }

  /**
   * Vérification enseignement explicite
   * Doit contenir marqueurs explicites SANS questions socratiques
   */
  private hasExplicitTeaching(response: string): boolean {
    const explicitMarkers = [
      /DÉFINITION|définition/i,
      /voici/i,
      /je vais t'expliquer/i,
      /c'est un/i,
      /il s'agit de/i,
      /on appelle/i,
      /cela signifie/i,
      /c'est quand/i
    ];

    // Ne doit PAS contenir questions socratiques pour définitions
    const socraticQuestions = [
      /qu'en penses.?tu/i,
      /selon toi/i,
      /peux.?tu deviner/i,
      /essaie de trouver/i,
      /quelle est ta réponse/i,
      /comment dirais.?tu/i
    ];

    const hasExplicit = explicitMarkers.some(pattern => pattern.test(response));
    const hasSocratic = socraticQuestions.some(pattern => pattern.test(response));

    return hasExplicit && !hasSocratic;
  }

  /**
   * Vérification KaTeX présent
   */
  private hasKaTeX(response: string): boolean {
    return response.includes('$$') || response.includes('\\[') || response.includes('\\(');
  }

  /**
   * Détection formules mathématiques
   * Détecte uniquement les vraies formules mathématiques, pas les fractions dans le texte narratif
   */
  private hasFormulas(response: string): boolean {
    const formulaPatterns = [
      // Équations avec signe égal (a = b, x + 2 = 5)
      /[a-z]\s*[+\-*/×÷]?\s*\d*\s*=\s*/i,

      // Opérations mathématiques avec plusieurs termes (2 + 3 - 1, a × b + c)
      /\d+\s*[+\-*/×÷]\s*\d+\s*[+\-*/×÷]/,
      /[a-z]\s*[+\-*/×÷]\s*[a-z]/i,

      // Puissances et racines
      /\d+\^\d+/,
      /√/,

      // Expressions avec parenthèses et opérateurs
      /\([^)]*[+\-*/×÷][^)]*\)/,

      // Fractions en notation verticale ou avec barre de fraction dans contexte mathématique
      // (mais PAS juste "1/2" dans une phrase)
      /(?:^|\n)\s*\d+\s*\/\s*\d+\s*(?:\n|$)/m, // Fraction isolée sur sa ligne
      /(?:formule|calcul|aire|périmètre|résultat).*\d+\s*\/\s*\d+/i // Fraction dans contexte mathématique
    ];

    return formulaPatterns.some(pattern => pattern.test(response));
  }

  /**
   * Détection ton informel
   */
  private hasInformalTone(response: string): boolean {
    const informalMarkers = [
      /haha|lol|mdr/i,
      /trop cool|super cool/i,
      /c'est ouf|c'est ouff/i,
      /grave/i,
      /wesh/i,
      /stylé/i,
      /cool(?!\s*down)/i, // "cool" mais pas "cool down"
      /bro|mec/i
    ];

    return informalMarkers.some(pattern => pattern.test(response));
  }

  /**
   * Vérification utilisation contexte RAG
   * Au moins 30% des keywords significatifs doivent être présents
   */
  private usesRAGContext(response: string, ragContext: string): boolean {
    // Extraire mots-clés significatifs du contexte RAG
    const contextKeywords = ragContext
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 5) // Mots significatifs
      .filter((word, index, arr) => arr.indexOf(word) === index) // Uniques
      .slice(0, 20); // Top 20 mots

    if (contextKeywords.length === 0) {
      return true; // Pas de keywords à vérifier
    }

    const responseLower = response.toLowerCase();

    // Compter matches
    const matchedKeywords = contextKeywords.filter(keyword =>
      responseLower.includes(keyword)
    );

    // Au moins 30% des keywords doivent être présents
    return matchedKeywords.length >= Math.ceil(contextKeywords.length * 0.3);
  }

  /**
   * Détection blagues
   */
  private containsJokes(response: string): boolean {
    const jokeMarkers = [
      /blague/i,
      /rigol/i,
      /drôle/i,
      /😂|🤣|😜|😝/,
      /haha|hihi/i,
      /pourquoi.*poulet/i // Blagues classiques
    ];

    return jokeMarkers.some(pattern => pattern.test(response));
  }

  /**
   * Détection matière mathématique
   */
  private isMathSubject(subject: string): boolean {
    const mathSubjects = ['mathematiques', 'physique', 'chimie', 'sciences'];
    const subjectLower = subject.toLowerCase();
    return mathSubjects.some(mathSubject => subjectLower.includes(mathSubject));
  }

  // ===================================================
  // CRÉATION VIOLATIONS
  // ===================================================

  /**
   * Créer violation détaillée avec evidence + suggestion
   */
  private createViolation(
    ruleName: string,
    response: string,
    params: GenerationParams
  ): Violation {
    const violations: Record<string, Violation> = {
      EXPLICIT_TEACHING_REQUIRED: {
        rule: 'EXPLICIT_TEACHING_REQUIRED',
        severity: 'high',
        evidence: `User asked "${params.userQuery}" but response uses Socratic method instead of explicit teaching`,
        suggestion: 'Provide direct definition with DÉFINITION marker. Use explicit teaching for concepts.'
      },
      KATEX_REQUIRED: {
        rule: 'KATEX_REQUIRED',
        severity: 'medium',
        evidence: 'Math formulas detected but not using KaTeX notation ($$)',
        suggestion: 'Wrap all math formulas with $$formula$$ notation for proper rendering.'
      },
      PROFESSIONAL_TONE_REQUIRED: {
        rule: 'PROFESSIONAL_TONE_REQUIRED',
        severity: 'medium',
        evidence: 'Informal language detected (haha, lol, cool, etc.)',
        suggestion: 'Use professional educational tone. Avoid slang and informal expressions.'
      },
      RAG_CONTEXT_USAGE: {
        rule: 'RAG_CONTEXT_USAGE',
        severity: 'low',
        evidence: 'Official educational context provided but not sufficiently referenced in response',
        suggestion: 'Incorporate more keywords from official programs when provided via RAG.'
      },
      NO_JOKES: {
        rule: 'NO_JOKES',
        severity: 'medium',
        evidence: 'Joke or humorous content detected in educational response',
        suggestion: 'Maintain professional educational focus. Redirect to learning content.'
      }
    };

    return violations[ruleName] || {
      rule: ruleName,
      severity: 'low',
      evidence: `Validation failed for rule: ${ruleName}`,
      suggestion: 'Review response quality and compliance with educational standards.'
    };
  }

  /**
   * Calculer score conformité (0-1) pondéré par weights
   */
  private calculateComplianceScore(
    passedRules: string[]
  ): number {
    let totalWeight = 0;
    let achievedWeight = 0;

    for (const [ruleName, ruleConfig] of Object.entries(this.VALIDATION_RULES)) {
      totalWeight += ruleConfig.weight;
      if (passedRules.includes(ruleName)) {
        achievedWeight += ruleConfig.weight;
      }
    }

    return totalWeight > 0 ? achievedWeight / totalWeight : 0;
  }
}

// Export singleton
export const promptValidationService = new PromptValidationService();
