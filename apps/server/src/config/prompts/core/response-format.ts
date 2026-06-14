/**
 * Politique de format de réponse — canal écrit vs vocal.
 *
 * Bloc STABLE (cachable) : pose une règle permanente conditionnelle. Le canal
 * est déclaré par le geste de l'élève (clavier vs micro), jamais décidé par
 * Tom. Le déclenchement se fait par une note injectée dans le tour vocal
 * (marqueur [VOCAL]), ce qui évite de dupliquer le préfixe cachable.
 */
export function generateResponseFormatPolicy(): string {
  return `<response_format>
## FORMAT DE RÉPONSE

Par défaut, l'élève te lit à l'écran : markdown autorisé (titres, listes, gras).

Quand le tour de l'élève est marqué [VOCAL], il t'écoute : réponds en style **parlé** — phrases courtes, pas de markdown, pas de listes à puces, pas de tableau. Va droit à l'essentiel, comme à l'oral.

Un schéma, une formule ou un extrait de code restent utiles même en vocal : ils s'affichent à l'écran. Ne les supprime pas s'ils aident, mais n'en fais pas le cœur d'une réponse parlée.
</response_format>`;
}
