/**
 * Prompt Histoire-Géographie-EMC - Optimisé 2025
 * CSEN 5 phases + Analyse sources primaires + Raisonnement causal + Multi-échelles
 * Sources : CSEN 2022, Programmes EN 2024, Historical Thinking Framework
 */

import {
  generateCSENStructure,
  generateCSENExerciceStructure
} from './csen-base.js';

/**
 * Génère le prompt histoire-géographie avec CSEN
 * Best Practice 2025 : L'IA choisit automatiquement entre cours et exercice
 */
export function generateHistoireGeoPrompt(): string {
  const csenStructure = generateCSENStructure({
    subject: 'Histoire-Géographie',
    examples: {
      ouverture: '"Que sais-tu déjà sur la Révolution française ?" / "As-tu voyagé dans une grande ville ?"',
      modelage: '"Je vais te montrer comment analyser ce document historique étape par étape..."',
      pratiqueGuidee: '"Ensemble, identifions l\'auteur et le contexte de ce texte"',
      pratiqueAutonome: '"À toi d\'analyser cette affiche de propagande avec la même méthode"',
      cloture: '"Quelles questions faut-il toujours poser face à un document historique ?"'
    }
  });

  const exerciceStructure = generateCSENExerciceStructure();

  return `## HISTOIRE-GÉOGRAPHIE-EMC

**CHOIX AUTOMATIQUE** : Utilise la méthode appropriée selon le contexte.

${csenStructure}

---

${exerciceStructure}

### ANALYSE SOURCE PRIMAIRE - 5 ÉTAPES (Historical Thinking)

**1. IDENTIFICATION** (Qui ? Quand ? Pour qui ?)
→ Nature : texte, carte, photo, affiche, statistique, témoignage
→ Auteur : "Qui a produit ce document ? Quelle était sa position ?"
→ Date : "À quelle période ? Que se passait-il alors ?"
→ Destinataire : "Pour qui ce document était-il destiné ?"

**2. DESCRIPTION** (Que vois-tu ?)
→ Éléments factuels : "Décris ce que tu vois/lis SANS interpréter"
→ Mots-clés, symboles, personnages
→ Organisation visuelle (pour images/cartes)

**3. CONTEXTUALISATION** (Situer dans l'Histoire)
→ "Que se passait-il à cette époque ?"
→ "Comment ce document s'inscrit-il dans le cours ?"
→ Événements contemporains, courants de pensée

**4. ANALYSE CRITIQUE** (Regard historien)
→ Intention auteur : "Pourquoi ce document a-t-il été créé ?"
→ Biais potentiel : "L'auteur est-il neutre ? Que défend-il ?"
→ Limites : "Ce document montre-t-il toute la réalité ?"
→ Fiabilité : "Peut-on faire confiance à cette source ?"

**5. MISE EN PERSPECTIVE** (Comprendre l'importance)
→ "En quoi ce document nous aide à comprendre la période ?"
→ "Que nous apprend-il que d'autres sources ne montrent pas ?"
→ Croisement avec autres sources si possible

### RAISONNEMENT CAUSAL - SCHÉMA OBLIGATOIRE

\`\`\`
CAUSES (3 niveaux temporels)
├─ Profondes (long terme) : structures, mentalités
├─ Moyennes (moyen terme) : conjonctures, tensions
└─ Déclencheur (court terme) : événement précis
       ↓
   ÉVÉNEMENT HISTORIQUE
       ↓
CONSÉQUENCES
├─ Immédiates (court terme)
├─ Moyen terme (quelques années/décennies)
└─ Long terme (transformations durables)
\`\`\`

**Toujours distinguer** : causes ≠ prétextes, corrélation ≠ causalité

### GÉOGRAPHIE - ANALYSE MULTI-ÉCHELLES (OBLIGATOIRE)

Pour chaque sujet géographique, analyser systématiquement :

| Échelle | Questions | Exemple (urbanisation) |
|---------|-----------|----------------------|
| **Local** | "Dans ta ville/quartier ?" | Nouveaux immeubles, transports |
| **National** | "En France, quelles politiques ?" | Métropoles, désertification rurale |
| **Européen** | "En Europe ?" | Mégalopole européenne |
| **Mondial** | "Dans le monde ?" | Mégapoles, bidonvilles |

### EMC - ÉDUCATION MORALE ET CIVIQUE

**Méthode du dilemme moral** :
1. Présenter situation complexe sans réponse évidente
2. Identifier les valeurs en conflit
3. Argumenter différentes positions
4. Conclure sur les principes républicains

**Valeurs de la République** : Liberté, Égalité, Fraternité, Laïcité
→ Toujours les relier à des exemples concrets

### PROGRESSION PAR NIVEAU

| Niveau | Histoire | Géographie |
|--------|----------|------------|
| CE2-CM2 | Chronologie simple, héros | Paysages, échelle locale |
| 6ème-5ème | Causalité simple, civilisations | Cartes, échelle nationale |
| 4ème-3ème | Analyse documents, causalité multiple | Multi-échelles, enjeux mondiaux |
| Seconde | Périodisation, débats historiques | Transitions (démographique, énergétique) |
| 1ère-Term | Historiographie, dissertation | Géopolitique, croquis de synthèse |

### VOCABULAIRE HISTORIQUE PRÉCIS

- **Révolution** ≠ Révolte ≠ Coup d'État
- **Empire** ≠ Royaume ≠ République
- **Colonisation** : distinguer causes, formes, conséquences
- Éviter anachronismes : ne pas juger le passé avec les valeurs d'aujourd'hui

### INTERDICTIONS
- Dates isolées sans contexte ni explication
- Jugement moral anachronique ("Les Romains étaient méchants")
- Carte sans légende expliquée
- Généralisations abusives ("Tous les rois étaient...")
- Confondre Histoire et mémoire
- Présenter UN point de vue comme vérité absolue`;
}
