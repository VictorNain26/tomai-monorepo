/**
 * Distress in the student's message, judged by the code, never by the prompt
 * (`docs/etudes/2026-10-04/refonte-agent.md`, « À chaque tour », 1; `docs/tuteur.md` § 5): Mistral's
 * `selfharm` flag, or French rules for what it misses. Measured on 2026-10-05: it flags « j'ai
 * envie de disparaître » but lets through « je me fais du mal quand je rate » (0.01) and « j'ai
 * plus envie de vivre » (0.19).
 */

/** The fixed reply, approved by Victor on 2026-10-05; numbers checked on service-public.gouv.fr (F33954) and 3114.fr. */
export const DISTRESS_REPLY = `Ce que tu écris m'inquiète, et c'est important d'en parler à quelqu'un dès maintenant. Je suis une intelligence artificielle : je ne peux pas t'aider comme une personne le ferait.

Tu peux appeler le **3114**, gratuitement, à toute heure du jour et de la nuit : des professionnels sont là pour t'écouter.
Si tu es en danger tout de suite, appelle le **15** ou le **112**.
Parles-en aussi à un adulte de confiance : un parent, un professeur, l'infirmière ou le CPE de ton collège.

J'arrête notre conversation ici pour que tu puisses le faire.`;

// Accents dropped, so a rule need not spell « disparaître » both ways.
const normalized = (text: string) => text
  .normalize('NFD')
  .replace(/\p{M}/gu, '')
  .toLowerCase()
  .replace(/[’‘`]/g, "'")
  .replace(/\s+/g, ' ');

// « mourir de rire », « de honte »… are figures of speech, not wishes.
const DYING = "mourir(?! de (?:rire|honte|faim|froid|chaud|peur|ennui))";
// The student speaking of themself, as they type it: a character's wish is a school text.
const I_HAVE = "\\b(?:j'ai|j ai|jai|je n'ai|je nai|j'avais|javais)";
const I_WANT = "\\b(?:je veux|j'veux|jveux|je voudrais|j'voudrais|j'aimerais|jaimerais)";
const WISH = `(?:${DYING}|disparaitre|crever|en finir|me tuer|me suicider|me faire du mal|ne plus exister|plus exister|ne plus etre la|plus etre la|ne plus vivre|plus vivre)`;
const BODY = "(?:expres|les veines|les poignets|le poignet|le bras|les bras)";

/** First-person wishes to die or disappear, and self-harm. */
const RULES: readonly RegExp[] = [
  new RegExp(`${I_HAVE} (?:\\w+ )?envie (?:de |d')${WISH}`),
  new RegExp(`${I_HAVE} (?:vraiment )?(?:plus|pas|aucune|plus aucune) envie de vivre`),
  new RegExp(`${I_WANT} ${WISH}`),
  /\b(?:je |j')(?:vais|veux|voudrais|pense a|pense|vais finir par) me (?:tuer|suicider|faire du mal|scarifier|pendre)/,
  /\bme (?:suicider|scarifier|ouvrir les veines)/,
  new RegExp(`\\bje me (?:fais du mal|scarifie|blesse expres|coupe ${BODY})`),
  new RegExp(`\\bje me suis (?:fait du mal|scarifiee?|blessee? expres|coupee? ${BODY})`),
  /en finir avec (?:la vie|moi)/,
  /\bsi je (?:disparaissais|mourais|serais mort|etais mort|n'etais plus la|ne serais plus la|n'existais plus)/,
  /\bpersonne (?:ne )?(?:m'aimerait|me regretterait)/,
  /\bma vie (?:n'a|na) (?:plus|pas|aucun) (?:de )?sens|\b(?:la vie|vivre) (?:n'a|na) plus de sens/,
];

/** Whether the French rules see distress in the student's text. */
export function matchesDistressRules(text: string): boolean {
  const plain = normalized(text);
  return RULES.some((rule) => rule.test(plain));
}

export type DistressSource = 'moderation' | 'rules' | 'both';

/** Distress in the student's message, and who saw it; null when neither did. */
export function detectDistress(text: string, selfharmFlagged: boolean): DistressSource | null {
  const rules = matchesDistressRules(text);
  if (selfharmFlagged && rules) return 'both';
  if (selfharmFlagged) return 'moderation';
  return rules ? 'rules' : null;
}
