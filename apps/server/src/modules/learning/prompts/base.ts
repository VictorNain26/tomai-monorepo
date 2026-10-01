/**
 * Prompts de base - Instructions KaTeX, Mermaid, et contenu enrichi
 *
 * Architecture Single-Phase 2025:
 * Ce fichier contient les constantes partagées pour le rendu enrichi.
 * Utilisé par card-generator.service.ts pour la génération de cartes.
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

