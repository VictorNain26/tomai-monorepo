/**
 * Distress in the student's message, judged by the code, never by the prompt
 * (`docs/etudes/2026-10-04/refonte-agent.md`, « À chaque tour », 1; `docs/agent.md` § 5): Mistral's
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
const SELF = "(?:me |m')";

/** First-person wishes to die or disappear, and self-harm, as a student types them. */
const RULES: readonly RegExp[] = [
  new RegExp(`envie de (?:${DYING}|disparaitre|crever|en finir)`),
  /(?:plus|pas|aucune) envie de vivre/,
  new RegExp(`(?:je veux|j'veux|je voudrais|j'aimerais) (?:${DYING}|disparaitre|en finir|ne plus exister|plus exister|ne plus etre la|plus etre la)`),
  new RegExp(`(?:je |j')(?:vais|veux|voudrais|pense a|pense|vais aller) ${SELF}(?:tuer|suicider|faire du mal|blesser|scarifier|pendre)`),
  new RegExp(`${SELF}(?:suicider|scarifier|ouvrir les veines)`),
  /je me (?:fais du mal|blesse expres|scarifie|coupe les|frappe)/,
  /en finir avec (?:la vie|tout|moi)/,
  /(?:si|quand) je (?:disparaissais|mourais|serais mort|n'etais plus la|ne serais plus la)/,
  /personne (?:ne )?(?:m'aimerait|me regretterait|le remarquerait|s'en rendrait compte)/,
  /la vie (?:n'a|na) (?:plus|pas) de sens/,
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
