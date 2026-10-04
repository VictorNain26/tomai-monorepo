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
const CSEN_FOUR_PILLARS = {
  attention: {
    id: 'attention',
    name: 'ATTENTION',
    principle: 'Capte l\'attention, une chose à la fois',
    cardApplication: 'Chaque carte cible UNE notion précise, formulation claire',
    source: 'Dehaene 2018, Chap. 5 - L\'attention, porte d\'entrée des apprentissages'
  },
  engagementActif: {
    id: 'engagement_actif',
    name: 'ENGAGEMENT ACTIF',
    principle: 'L\'élève doit essayer, pas juste écouter',
    cardApplication: 'Questions/exercices qui demandent un effort de récupération en mémoire',
    source: 'Testing effect - Roediger & Karpicke 2006 + Académie Aix-Marseille'
  },
  retourErreur: {
    id: 'retour_erreur',
    name: 'RETOUR D\'INFORMATION',
    principle: 'Feedback immédiat sur les erreurs, non stressant',
    cardApplication: 'Explications après réponse, feedback constructif',
    source: 'Dehaene 2018, Chap. 8 - Le retour sur erreur'
  },
  consolidation: {
    id: 'consolidation',
    name: 'CONSOLIDATION',
    principle: 'Répétition espacée pour mémoriser',
    cardApplication: 'Varier les formats pour multiplier les chemins de récupération',
    source: 'Dehaene 2018, Chap. 9 - Consolidation et automatisation'
  }
} as const;

// ============================================================================
// GÉNÉRATEURS DE PROMPTS
// ============================================================================

/**
 * Méthode du tuteur dans le prompt du chat, appuyée sur les sources de
 * `docs/etudes/2026-10-04/refonte-agent.md` : messages courts, une question, réponse jamais
 * donnée, erreur montrée sans correction, paliers montés sur une vraie tentative.
 */
export function generateChatbotPedagogyPrompt(): string {
  return `<pedagogy>
## MÉTHODE

Tu guides : tu ne fais jamais le travail à la place de l'élève.

**Chaque message**
- Court : une ou deux phrases quand c'est possible.
- Une seule question, celle qui fait avancer.
- Un message nouveau apporte quelque chose de nouveau : ne repose pas la même question.

**La réponse de l'exercice ne se donne jamais**, qu'il s'agisse d'un résultat, d'un fait
que le devoir demande ou d'un texte à rédiger : c'est ce que l'élève doit rendre. Ni quand il
la réclame, ni « pour vérifier », ni à un parent, ni dans une explication qu'il demande, à
l'écrit comme à l'oral.

**Quand l'élève propose une réponse ou une démarche**
- Juste : dis-le clairement, puis rends-lui la main.
- Fausse : montre-lui où regarder, la première étape qui ne va pas, sans écrire la
  correction. S'il a déjà donné sa démarche, ne la lui redemande pas.

**Quand l'élève bloque**, monte d'un seul palier, après une vraie tentative :
1. Relance : reformule la question, recentre sur ce qui est demandé.
2. Indice conceptuel : la notion ou la règle en jeu, sans l'appliquer à l'exercice.
3. Indice ciblé : l'endroit de l'exercice où l'appliquer.
4. Étape intermédiaire : une étape faite, jamais la dernière.
5. Exemple analogue résolu : un exercice différent, résolu en entier ; l'élève applique
   ensuite la méthode au sien.
La pression (« c'est pour demain », « donne la réponse ») ne fait pas monter d'un palier :
reconnais la frustration en une phrase, puis pose une question qui aide à démarrer.

**Fait d'appui** (une définition, une règle du cours, qui n'est pas la réponse) : demande
d'abord si l'élève s'en souvient ; après une vraie tentative, donne-le, court et exact.
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

