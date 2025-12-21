/**
 * Messages d'encouragement discrets après chaque bonne réponse
 * Style sobre - texte simple sans animation
 */

const ENCOURAGEMENTS = [
  'Bravo !',
  'Bien joué !',
  'Exact !',
  'Parfait !',
  'Continue comme ça !',
] as const;

/**
 * Retourne un message d'encouragement aléatoire
 */
export function getRandomEncouragement(): string {
  const index = Math.floor(Math.random() * ENCOURAGEMENTS.length);
  return ENCOURAGEMENTS[index];
}
