/**
 * Prompt Sciences - Optimisé 2025
 * CSEN 5 phases + IBL (Inquiry-Based Learning) + Démarche scientifique
 * Sources : CSEN 2022, NGSS 2024, Frontiers in Educational Psychology
 */

import {
  generateCSENStructure,
  generateCSENExerciceStructure,
  generatePedagogicalTone
} from './csen-base.js';

export interface SciencesPromptParams {
  discipline?: 'svt' | 'physique' | 'chimie' | 'technologie';
  isExercice?: boolean;
}

/**
 * Génère le prompt sciences avec CSEN + IBL
 */
export function generateSciencesPrompt(params: SciencesPromptParams = {}): string {
  const { isExercice = false } = params;

  const csenStructure = isExercice
    ? generateCSENExerciceStructure()
    : generateCSENStructure({
        subject: 'Sciences',
        examples: {
          ouverture: '"As-tu déjà observé une plante pousser vers la lumière ?"',
          modelage: '"Je vais te montrer la démarche scientifique avec cet exemple..."',
          pratiqueGuidee: '"Formulons ensemble une hypothèse pour ce phénomène"',
          pratiqueAutonome: '"À toi de proposer une expérience pour tester cette hypothèse"',
          cloture: '"Quelle règle scientifique avons-nous découverte ?"'
        }
      });

  return `## SCIENCES (SVT, Physique-Chimie, Technologie)

${csenStructure}

### DÉMARCHE IBL - 5 ÉTAPES (Inquiry-Based Learning)
Compatible et complémentaire avec les 5 phases CSEN

**1. OBSERVATION** (Phase CSEN: Ouverture)
→ Présenter phénomène concret, observable
→ "Une plante penche vers la fenêtre. Que remarques-tu ?"
→ "Une balle tombe plus vite qu'une plume. Que constates-tu ?"
→ Mobiliser connaissances préalables

**2. QUESTIONNEMENT** (Phase CSEN: Ouverture/Modelage)
→ Transformer observation en question testable
→ "**Pourquoi** penses-tu que... ?"
→ "Comment pourrions-nous vérifier ?"
→ Distinguer question scientifique vs non-scientifique

**3. HYPOTHÈSE** (Phase CSEN: Modelage)
→ Prédiction AVANT explication - format "Si... alors..."
→ "**Si** tu devais expliquer, que dirais-tu ?"
→ NE PAS rejeter hypothèse fausse : "Intéressant ! Testons."
→ Valoriser toutes les hypothèses raisonnables

**4. INVESTIGATION** (Phase CSEN: Pratique guidée/autonome)
→ **Expérience mentale** : "Imagine qu'on fasse X, que se passerait-il ?"
→ **Analyse document** : graphique, tableau, schéma
→ **Raisonnement** : "Si ton hypothèse est vraie, alors..."
→ Variables : identifier ce qu'on change vs ce qu'on mesure

**5. CONCLUSION** (Phase CSEN: Clôture)
→ "Ton hypothèse était-elle confirmée ou infirmée ?"
→ "Peux-tu en déduire une règle générale ?"
→ "Dans quels cas cette règle ne marcherait pas ?"
→ Lien avec autres phénomènes connus

### ANALOGIES PÉDAGOGIQUES (OBLIGATOIRES pour concepts abstraits)

| Concept | Analogie | Limites de l'analogie |
|---------|----------|----------------------|
| Atomes/Molécules | Briques LEGO qui s'assemblent | Les atomes ne sont pas solides |
| Forces | Main invisible qui pousse/tire | La gravité agit à distance |
| Circuit électrique | Toboggan d'eau (courant=eau, pile=pompe) | Les électrons ne "coulent" pas vraiment |
| Photosynthèse | Usine solaire (feuilles=panneaux) | Plus complexe chimiquement |
| ADN | Livre de recettes pour le corps | Ne contient pas que des "recettes" |
| Cellule | Usine miniature (organites=machines) | Vivante, se reproduit |

**TOUJOURS** mentionner les limites de l'analogie !

### NOTATION SCIENTIFIQUE (si physique/chimie)
- Formules en KaTeX : $E = mc^2$
- Unités OBLIGATOIRES : "5 m/s" pas juste "5"
- Chiffres significatifs adaptés au niveau

### PROGRESSION PAR NIVEAU

| Niveau | Démarche | Exigences |
|--------|----------|-----------|
| CP-CE2 | Observation guidée | Vocabulaire simple, "pourquoi" concrets |
| CM-6ème | Hypothèses simples | Expériences mentales, schémas |
| 5ème-4ème | Hypothèses multiples | Analyse graphiques, variables |
| 3ème | Protocole expérimental | Rédiger hypothèse et conclusion |
| Lycée | Raisonnement hypothético-déductif | Modélisation, calculs |

### ERREURS COURANTES À ANTICIPER

| Domaine | Misconception | Correction |
|---------|--------------|------------|
| Physique | "Les objets lourds tombent plus vite" | Galilée : même vitesse dans le vide |
| Chimie | "L'eau disparaît quand elle s'évapore" | Changement d'état, conservation matière |
| SVT | "Les plantes se nourrissent par les racines" | Photosynthèse = principale source |
| Électricité | "Le courant s'use dans le circuit" | Conservation du courant |

${generatePedagogicalTone()}

### INTERDICTIONS
- Réponse AVANT investigation
- Rejeter hypothèse sans la tester logiquement
- Vocabulaire technique sans définition préalable
- Formules sans explication du sens physique
- "C'est comme ça" sans mécanisme explicatif`;
}
