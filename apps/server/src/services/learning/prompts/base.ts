/**
 * Prompts de base - Instructions KaTeX, Mermaid, et contenu enrichi
 *
 * Architecture Meta-Planning 2025:
 * Ce fichier contient les constantes partagées pour le rendu enrichi.
 *
 * Les prompts principaux sont dans :
 * - deck-planner.prompt.ts (Phase 1 - Planning)
 * - prompt-builder.service.ts (Phase 2 - Exécution)
 */

// ============================================================================
// KATEX INSTRUCTIONS
// ============================================================================

/**
 * Instructions pour le rendu des formules mathématiques
 * Utilisé par les matières scientifiques (maths, physique-chimie, SVT)
 */
export const KATEX_INSTRUCTIONS = `## KaTeX (formules mathématiques)

- Inline: $formule$ — Display: $$formule$$
- Dans JSON: double backslash (\\\\pi → \\pi)
- Syntaxe courante: \\frac{a}{b}, \\sqrt{x}, x^2, x_1, \\times, \\leq, \\geq, \\pi, \\sum, \\int`;

// ============================================================================
// RICH CONTENT INSTRUCTIONS
// ============================================================================

/**
 * Instructions pour enrichir le contenu avec tableaux et diagrammes
 * Rend les explications plus visuelles et compréhensibles
 */
export const RICH_CONTENT_INSTRUCTIONS = `## CONTENU ENRICHI (tableaux et diagrammes)

Utilise ces formats pour rendre les explications plus claires :

**Tableaux Markdown** (comparaisons, synthèses, conjugaisons) :
| Élément | Description | Exemple |
|---------|-------------|---------|
| Donnée 1 | Explication | $x^2$ |

**Diagrammes Mermaid** (flowcharts simples uniquement) :
- Utilise UNIQUEMENT graph TD (top-down) ou graph LR (left-right)
- Syntaxe simplifiée : A --> B ou A -->|label| B
- Limite à 3-5 noeuds maximum pour la lisibilité

Exemple dans JSON :
"explanation": "Voici le processus :\\n\\n\`\`\`mermaid\\ngraph TD\\n  A[Début] --> B[Milieu]\\n  B --> C[Fin]\\n\`\`\`"

**Quand utiliser quoi :**
- **Tableau** : Comparaisons, conjugaisons, propriétés (PRÉFÉRÉ)
- **Flowchart** : Algorithmes simples, étapes séquentielles
- **Listes** : Énumérations, points clés

**Important :** Les tableaux sont plus fiables que Mermaid. Privilégie les tableaux.`;
