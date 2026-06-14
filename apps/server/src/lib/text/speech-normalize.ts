/**
 * Normalise un texte contenant du markdown et/ou du KaTeX en texte lisible à voix haute.
 *
 * Priorités :
 * 1. Markdown : les symboles de formatage sont retirés, le texte reste intact.
 * 2. KaTeX : les cas courants sont convertis en français parlé ;
 *    tout LaTeX non reconnu est strippé (commandes `\cmd`, accolades, `$`).
 *
 * Invariant fort : aucun `$` ni `\` ne doit subsister après normalisation.
 */

// ---------------------------------------------------------------------------
// KaTeX — conversions de cas courants en français parlé
// ---------------------------------------------------------------------------

// Ordre important : les patterns les plus spécifiques passent avant les généraux.
const KATEX_CONVERSIONS: [RegExp, string][] = [
  // Fractions : \frac{a}{b} → a sur b
  [/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1 sur $2'],

  // Racine : \sqrt{x} → racine de x
  [/\\sqrt\{([^}]+)\}/g, 'racine de $1'],

  // Puissances : ^{n} et ^n (avant de traiter les exposants connus)
  // x^2, x^3 en priorité, puis cas général
  [/\^2/g, ' au carré'],
  [/\^3/g, ' au cube'],
  [/\^\{([^}]+)\}/g, ' puissance $1'],
  [/\^([a-zA-Z0-9])/g, ' puissance $1'],

  // Opérateurs
  [/\\times/g, 'fois'],
  [/\\div/g, 'divisé par'],

  // Comparaisons (ordre : \\leq avant \\le pour éviter match partiel)
  [/\\leq/g, 'inférieur ou égal à'],
  [/\\le(?![a-zA-Z])/g, 'inférieur ou égal à'],
  [/\\geq/g, 'supérieur ou égal à'],
  [/\\ge(?![a-zA-Z])/g, 'supérieur ou égal à'],

  // Constantes et symboles courants
  [/\\pi(?![a-zA-Z])/g, 'pi'],
];

/**
 * Normalise le contenu d'une formule mathématique (sans les délimiteurs $).
 * Applique les conversions connues, puis retire toute commande LaTeX résiduelle.
 */
function normalizeFormula(formula: string): string {
  let result = formula.trim();

  for (const [pattern, replacement] of KATEX_CONVERSIONS) {
    result = result.replace(pattern, replacement);
  }

  // Strip toute commande LaTeX résiduelle non gérée : \cmd
  result = result.replace(/\\[a-zA-Z]+/g, '');

  // Retire les accolades restantes
  result = result.replace(/[{}]/g, '');

  // Retire les underscore d'indice LaTeX
  result = result.replace(/_/g, '');

  return result.trim();
}

// ---------------------------------------------------------------------------
// Normalisation principale
// ---------------------------------------------------------------------------

export function normalizeForSpeech(text: string): string {
  let result = text;

  // 1. Blocs de code fencés (avant tout autre traitement pour éviter
  //    que le contenu soit traité par les règles markdown suivantes)
  result = result.replace(/```[\s\S]*?```/g, '');

  // 2. Formules KaTeX en bloc $$ ... $$ (avant les formules inline)
  result = result.replace(/\$\$([\s\S]+?)\$\$/g, (_, formula: string) => normalizeFormula(formula));

  // 3. Formules KaTeX inline $ ... $
  result = result.replace(/\$([^$\n]+?)\$/g, (_, formula: string) => normalizeFormula(formula));

  // Invariant intermédiaire : plus aucun `$` ni `\` ne doit subsister à ce stade.
  // (Les règles markdown ci-dessous ne peuvent pas en introduire.)

  // 4. Titres markdown : ## Titre → Titre
  result = result.replace(/^#{1,6}\s+/gm, '');

  // 5. Gras : **texte** ou __texte__ → texte
  result = result.replace(/\*\*([^*]+)\*\*/g, '$1');
  result = result.replace(/__([^_]+)__/g, '$1');

  // 6. Italique : *texte* ou _texte_ → texte
  //    On évite de matcher des astérisques de liste (déjà traités après)
  result = result.replace(/\*([^*\n]+)\*/g, '$1');
  result = result.replace(/_([^_\n]+)_/g, '$1');

  // 7. Code inline : `texte` → texte
  result = result.replace(/`([^`]+)`/g, '$1');

  // 8. Liens : [texte](url) → texte
  result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // 9. Marqueurs de liste numérotée : "1. " → ""
  result = result.replace(/^\d+\.\s+/gm, '');

  // 10. Marqueurs de liste non-ordonnée : "- " ou "* " en début de ligne → ""
  result = result.replace(/^[-*]\s+/gm, '');

  // 11. Citations blockquote : "> " → ""
  result = result.replace(/^>\s?/gm, '');

  // 12. Nettoyage des espaces multiples et lignes vides consécutives
  result = result.replace(/[ \t]+/g, ' ');
  result = result.replace(/\n{3,}/g, '\n\n');
  result = result.trim();

  return result;
}

/**
 * Tells whether an assistant answer is worth reading aloud. Returns false when
 * it carries a Mermaid diagram, a fenced code block or a markdown table — visual
 * structures the client should show, not speak. KaTeX formulas stay speakable:
 * `normalizeForSpeech` verbalizes them ("a sur b"). Used to set the
 * `speakable` hint on the chat `done` event; the client/user decides what to do.
 */
export function isSpeakable(text: string): boolean {
  // Any fence covers both ```mermaid diagrams and ``` code blocks.
  if (text.includes('```')) return false;
  // Markdown table delimiter row, e.g. |---|:--:| .
  if (/\|[\s:-]*-{3,}[\s:|-]*\|/.test(text)) return false;
  return true;
}
