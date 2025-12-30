/**
 * Principes Pédagogiques CSEN - Source Unique
 *
 * Ce fichier centralise les principes du CSEN (Conseil Scientifique de l'Éducation
 * Nationale) utilisés par TOUTES les features éducatives de Tom :
 * - Chatbot (tutorat socratique)
 * - Cards (flashcards de révision)
 * - Future: Quiz, exercices, etc.
 *
 * ## Sources Officielles CSEN
 *
 * - Dehaene, S. (2018). Apprendre ! Les talents du cerveau, le défi des machines.
 * - CSEN "Recommandations pédagogiques" (2019)
 * - CSEN "Résoudre des problèmes" (2021)
 * - Académie Paris: https://pia.ac-paris.fr/portail/jcms/p1_3354981
 * - Testing effect: https://www.site.ac-aix-marseille.fr/lyc-stexupery/spip/Tester-les-eleves-pour-les-faire-memoriser.html
 * - MOOC "Psychologie pour les enseignants" - Dr. Franck Ramus (membre CSEN)
 *
 * ## Extensions Scientifiques (non-CSEN mais académiquement validées)
 *
 * Ces principes sont documentés séparément pour transparence :
 * - Elaborative Interrogation: Pressley et al. (1987)
 * - Scaffolding / ZPD: Vygotsky (1978)
 * - Dual Coding: Paivio (1986)
 */

// ============================================================================
// 4 PILIERS DE L'APPRENTISSAGE (Stanislas Dehaene, président CSEN)
// ============================================================================

/**
 * Les 4 piliers de l'apprentissage - Structure de données
 */
export const CSEN_FOUR_PILLARS = {
  attention: {
    id: 'attention',
    name: 'ATTENTION',
    principle: 'Capte l\'attention, une chose à la fois',
    cardApplication: 'Chaque carte cible UNE notion précise, formulation claire',
    chatApplication: 'Focus sur un concept avant de passer au suivant',
    source: 'Dehaene 2018, Chap. 5 - L\'attention, porte d\'entrée des apprentissages'
  },
  engagementActif: {
    id: 'engagement_actif',
    name: 'ENGAGEMENT ACTIF',
    principle: 'L\'élève doit essayer, pas juste écouter',
    cardApplication: 'Questions/exercices qui demandent un effort de récupération en mémoire',
    chatApplication: 'Poser des questions, faire réfléchir avant de donner la réponse',
    source: 'Testing effect - Roediger & Karpicke 2006 + Académie Aix-Marseille'
  },
  retourErreur: {
    id: 'retour_erreur',
    name: 'RETOUR D\'INFORMATION',
    principle: 'Feedback immédiat sur les erreurs, non stressant',
    cardApplication: 'Explications après réponse, feedback constructif',
    chatApplication: 'Corriger avec bienveillance, expliquer pourquoi',
    source: 'Dehaene 2018, Chap. 8 - Le retour sur erreur'
  },
  consolidation: {
    id: 'consolidation',
    name: 'CONSOLIDATION',
    principle: 'Répétition espacée pour mémoriser',
    cardApplication: 'Varier les formats pour multiplier les chemins de récupération',
    chatApplication: 'Revenir sur les concepts, vérifier la compréhension',
    source: 'Dehaene 2018, Chap. 9 - Consolidation et automatisation'
  }
} as const;

/**
 * Type pour les piliers
 */
export type CSENPillarId = keyof typeof CSEN_FOUR_PILLARS;

// ============================================================================
// ENSEIGNEMENT EXPLICITE (Recommandations CSEN)
// ============================================================================

/**
 * Principes d'enseignement explicite du CSEN
 */
export const CSEN_EXPLICIT_TEACHING = {
  newConcept: 'Nouveau concept → Exemple résolu d\'abord, puis l\'élève essaie',
  progressiveSteps: 'Étapes claires et progressives',
  checkUnderstanding: 'Vérifier la compréhension avant d\'avancer',
  helpOnBlock: 'Si blocage → simplifier ou donner la réponse (pas de frustration)'
} as const;

// ============================================================================
// EXTENSIONS SCIENTIFIQUES (non-CSEN, académiquement validées)
// ============================================================================

/**
 * Extensions pédagogiques basées sur recherches académiques reconnues
 * Ces principes NE SONT PAS du CSEN mais sont scientifiquement validés
 */
export const SCIENTIFIC_EXTENSIONS = {
  elaboration: {
    name: 'Élaboration active',
    description: 'Reformuler un concept avec ses propres mots renforce l\'ancrage',
    source: 'Pressley, M. et al. (1987). Elaborative interrogation. Journal of Educational Psychology',
    usedFor: 'Type "reformulation" dans les cards'
  },
  scaffolding: {
    name: 'Étayage (Scaffolding)',
    description: 'Aide progressive pour atteindre la zone proximale de développement',
    source: 'Vygotsky, L. (1978). Mind in Society. Harvard University Press',
    usedFor: 'Champs "hints" optionnels, indices progressifs'
  },
  dualCoding: {
    name: 'Double codage',
    description: 'Combiner texte et image améliore la mémorisation',
    source: 'Paivio, A. (1986). Mental Representations: A Dual Coding Approach',
    usedFor: 'Champs "imageUrl" optionnels'
  },
  errorAnticipation: {
    name: 'Anticipation des erreurs',
    description: 'Signaler les erreurs fréquentes aide à les éviter',
    source: 'Chi, M. T. H. (1978). Knowledge structures and memory development',
    usedFor: 'Champs "commonMistakes" optionnels'
  }
} as const;

// ============================================================================
// GÉNÉRATEURS DE PROMPTS
// ============================================================================

/**
 * Génère le bloc des 4 piliers pour le CHATBOT
 * Format adapté au tutorat conversationnel
 */
export function generateChatbotPedagogyPrompt(): string {
  return `<pedagogy>
## PÉDAGOGIE (CSEN - Éducation Nationale)

**4 PILIERS DE L'APPRENTISSAGE** (Dehaene):
1. ${CSEN_FOUR_PILLARS.attention.name} → ${CSEN_FOUR_PILLARS.attention.principle}
2. ${CSEN_FOUR_PILLARS.engagementActif.name} → ${CSEN_FOUR_PILLARS.engagementActif.principle}
3. ${CSEN_FOUR_PILLARS.retourErreur.name} → ${CSEN_FOUR_PILLARS.retourErreur.principle}
4. ${CSEN_FOUR_PILLARS.consolidation.name} → ${CSEN_FOUR_PILLARS.consolidation.principle}

**ENSEIGNEMENT EXPLICITE** (CSEN):
- ${CSEN_EXPLICIT_TEACHING.newConcept}
- ${CSEN_EXPLICIT_TEACHING.progressiveSteps}
- ${CSEN_EXPLICIT_TEACHING.checkUnderstanding}
- ${CSEN_EXPLICIT_TEACHING.helpOnBlock}

**AIDE AUX DEVOIRS**:
1. "Que demande l'exercice ?"
2. "Comment tu comptes t'y prendre ?"
3. Résolution étape par étape avec feedback
4. "Vérifie ta réponse"

**ADAPTATION**:
- Élève perdu → Aide directe, pas de frustration
- Élève qui progresse → Indices, encouragements
- Élève autonome → Moins d'aide, plus de challenge
</pedagogy>`;
}

/**
 * Génère le bloc des 4 piliers pour les CARDS
 * Format compact optimisé pour réduire les tokens
 */
export function generateCardsPedagogyPrompt(): string {
  return `**4 Piliers de l'apprentissage (CSEN - Stanislas Dehaene)** :
1. ${CSEN_FOUR_PILLARS.attention.name} : ${CSEN_FOUR_PILLARS.attention.cardApplication}
2. ${CSEN_FOUR_PILLARS.engagementActif.name} : ${CSEN_FOUR_PILLARS.engagementActif.cardApplication}
3. ${CSEN_FOUR_PILLARS.retourErreur.name} : ${CSEN_FOUR_PILLARS.retourErreur.cardApplication}
4. ${CSEN_FOUR_PILLARS.consolidation.name} : ${CSEN_FOUR_PILLARS.consolidation.cardApplication}

**Structure recommandée** :
- 1-2 cartes 'concept' d'abord (poser les notions avant de tester)
- Varier les types (pas 2 QCM consécutifs)
- Chaque carte autonome et compréhensible seule

**Champs OPTIONNELS** (extensions pédagogiques) :
- hints?: ["indice1", "indice2"] - aide progressive avant correction
- commonMistakes?: [{"mistake":"...", "why":"..."}] - erreurs fréquentes à éviter`;
}

/**
 * Génère un résumé court des principes (pour logs, debug, etc.)
 */
export function getPrinciplesSummary(): string {
  return Object.values(CSEN_FOUR_PILLARS)
    .map(p => `${p.name}: ${p.principle}`)
    .join(' | ');
}
