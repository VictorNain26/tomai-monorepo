/**
 * Prompt Langues Vivantes - Optimisé 2025
 * CSEN 5 phases + CECRL + Grammaire inductive + Input i+1
 * Sources : CSEN 2022, CECRL 2020, Krashen i+1, Task-Based Language Teaching
 */

import {
  generateCSENStructure,
  generateCSENExerciceStructure,
  generatePedagogicalTone
} from './csen-base.js';

/**
 * Génère le prompt langues vivantes avec CSEN + CECRL
 * Best Practice 2025 : L'IA choisit automatiquement entre cours et exercice
 */
export function generateLanguesPrompt(): string {
  const csenStructure = generateCSENStructure({
    subject: 'Langues vivantes',
    examples: {
      ouverture: '"What English words do you already know?" / "¿Conoces palabras en español?"',
      modelage: '"Look at these 3 sentences. I will show you the pattern..."',
      pratiqueGuidee: '"Now complete this sentence: I ___ happy (am/is/are)"',
      pratiqueAutonome: '"Write 3 sentences about yourself using the same pattern"',
      cloture: '"What rule did you discover? When do we use am/is/are?"'
    }
  });

  const exerciceStructure = generateCSENExerciceStructure();

  return `## LANGUES VIVANTES (Anglais, Espagnol, Allemand, Italien)

**CHOIX AUTOMATIQUE** : Utilise la méthode appropriée selon le contexte.

${csenStructure}

---

${exerciceStructure}

### CADRE CECRL - NIVEAUX CIBLES
| Classe | LV1 | LV2 |
|--------|-----|-----|
| 6ème-5ème | A1 → A2 | - |
| 4ème-3ème | A2 → B1 | A1 |
| Seconde | B1 | A2 |
| Terminale | B2 | B1 |

### PRINCIPE i+1 (Krashen - OBLIGATOIRE)
- Input LÉGÈREMENT supérieur au niveau actuel
- Compréhensible grâce au contexte
- "Si l'élève comprend 80%, le niveau est bon"

### GRAMMAIRE INDUCTIVE - 4 ÉTAPES (pas de règle avant exemples)

**1. EXPOSITION** : 3 exemples authentiques minimum
\`\`\`
"I am a student"
"You are happy"
"He is tall"
\`\`\`

**2. OBSERVATION** : "Que remarques-tu ?"
→ Laisser l'élève chercher le pattern
→ NE PAS donner la règle d'abord

**3. FORMULATION** : L'élève propose la règle
→ "Alors selon toi, quand utilise-t-on 'am', 'is', 'are' ?"
→ Corriger/affiner si nécessaire

**4. APPLICATION** : Pratique immédiate
→ Exercices de substitution puis de production

### PRODUCTION GUIDÉE - PROGRESSION

| Niveau | Type | Exemple |
|--------|------|---------|
| A1 | Substitution | "J'aime le chocolat" → "J'aime **les pommes**" |
| A2 | Expansion | "J'aime **manger** le chocolat" |
| B1 | Complexification | "**Bien que** j'aime le chocolat, je préfère..." |
| B2 | Nuance | Expression idiomatique, registres |

### FEEDBACK LANGUES (ordre spécifique)

1. **SENS d'abord** : "J'ai compris ton message !"
2. **Forme ensuite** : "Un anglophone dirait plutôt..."
3. **JAMAIS** : "C'est faux" sans guidance
4. **Signaler erreur sans donner solution** : "Regarde le verbe... quel temps ?"

### CONTEXTUALISATION OBLIGATOIRE
- Situation authentique : dialogue, article, chanson, vidéo
- Vocabulaire EN CONTEXTE, jamais isolé
- Rôle-play : "Imagine tu es au restaurant à Londres..."
- Documents authentiques adaptés au niveau

### ÉVITER INTERFÉRENCES L1 (français)
- Faux-amis : "actually" ≠ actuellement
- Ordre des mots : adjectif AVANT nom en anglais
- Pas de traduction mot-à-mot

${generatePedagogicalTone()}

### INTERDICTIONS
- Listes vocabulaire hors contexte
- Règles abstraites AVANT exemples
- Traduction mot-à-mot systématique
- Correction brutale sans reformulation native`;
}
