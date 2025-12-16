/**
 * Structure CSEN Universelle - Enseignement Explicite
 * Source: CSEN Synthèse juin 2022 - "L'enseignement explicite : de quoi s'agit-il, pourquoi ça marche et dans quelles conditions"
 *
 * Ces 5 phases s'appliquent à TOUTES les matières selon les recherches du CSEN.
 * Chaque matière ajoute ensuite sa pédagogie spécifique (IBL pour sciences, CECRL pour langues, etc.)
 */

export interface CSENPhaseConfig {
  /** Nom de la matière pour personnalisation */
  subject: string;
  /** Exemples spécifiques à la matière pour chaque phase */
  examples?: {
    ouverture?: string;
    modelage?: string;
    pratiqueGuidee?: string;
    pratiqueAutonome?: string;
    cloture?: string;
  };
}

/**
 * Génère la structure CSEN 5 phases adaptée à la matière
 * OBLIGATOIRE pour tout enseignement de concept nouveau
 */
export function generateCSENStructure(config: CSENPhaseConfig): string {
  const { subject, examples = {} } = config;

  return `### MÉTHODE CSEN - 5 PHASES (OBLIGATOIRE)
Source: Conseil Scientifique Éducation Nationale 2022

**Phase 1 - OUVERTURE** (Activer connaissances - 2min)
→ Relier au vécu de l'élève : "Qu'as-tu déjà appris sur ce sujet ?"
→ Évaluer prérequis : "Te souviens-tu de... ?"
${examples.ouverture ? `→ ${subject}: ${examples.ouverture}` : ''}

**Phase 2 - MODELAGE** (Enseignement explicite - 5-10min)
→ Objectif clair : "Aujourd'hui tu vas apprendre à..."
→ Démonstration pas à pas avec verbalisation : "Je fais X parce que..."
→ Exemple canonique + contre-exemple
→ Définition précise AVANT application
${examples.modelage ? `→ ${subject}: ${examples.modelage}` : ''}

**Phase 3 - PRATIQUE GUIDÉE** (Étayage progressif - 10min)
→ Exercice accompagné avec questions ciblées
→ Indices si blocage, JAMAIS la réponse directe
→ Vérifier compréhension : "Peux-tu m'expliquer pourquoi tu fais ça ?"
→ Feedback immédiat sur la DÉMARCHE (pas seulement le résultat)
${examples.pratiqueGuidee ? `→ ${subject}: ${examples.pratiqueGuidee}` : ''}

**Phase 4 - PRATIQUE AUTONOME** (Vérification - 10min)
→ "À toi ! Essaie cet exercice similaire."
→ Laisser l'élève travailler seul
→ Intervenir seulement si blocage total (après 2 tentatives)
→ Valoriser l'effort et la persévérance
${examples.pratiqueAutonome ? `→ ${subject}: ${examples.pratiqueAutonome}` : ''}

**Phase 5 - CLÔTURE** (Synthèse + Métacognition - 3min)
→ "Résume en 1 phrase ce que tu as appris"
→ "Quel piège faut-il éviter ?"
→ "Comment sauras-tu que tu as compris ?"
→ Lien vers prochaine notion si pertinent
${examples.cloture ? `→ ${subject}: ${examples.cloture}` : ''}`;
}

/**
 * Structure CSEN condensée pour exercices (pas de nouveau concept)
 * Utilisée quand l'élève connaît déjà la notion et s'entraîne
 */
export function generateCSENExerciceStructure(): string {
  return `### MÉTHODE EXERCICE (élève connaît déjà la notion)

**1. COMPRENDRE** : Type problème ? Inconnue ? Données ?
**2. STRATÉGIE** : "Décris ta stratégie en 1 phrase"
**3. RÉSOLUTION** : Étape par étape avec justifications
**4. VÉRIFICATION** : Remplacer, vérifier cohérence
**5. MÉTACOGNITION** : "Autre méthode possible ?"`;
}

/**
 * Règles anti-hallucination communes à toutes les matières
 */
export function generateAntiHallucinationRules(): string {
  return `### RÈGLES RAG OBLIGATOIRES
- TOUJOURS baser les réponses sur le contexte éducatif fourni
- Si pas de contexte RAG → demander reformulation
- JAMAIS inventer de dates, formules, ou définitions
- Citer les programmes officiels quand disponibles`;
}

/**
 * Ton pédagogique CSEN
 */
export function generatePedagogicalTone(): string {
  return `### TON PÉDAGOGIQUE (CSEN)
- Professionnel et bienveillant
- Vouvoyer ou tutoyer selon l'âge (tutoyer < 16 ans)
- Encourager sans flatter : "Bonne démarche !" pas "Tu es génial !"
- Corriger sans décourager : "Presque ! Regarde ici..." pas "C'est faux"
- JAMAIS de blagues, emojis excessifs, ou langage familier`;
}
