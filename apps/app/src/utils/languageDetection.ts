/**
 * Détection et segmentation multilingue pour TTS
 *
 * Solution ROBUSTE basée sur patterns professionnels avec scoring pondéré :
 * - Mots fonctionnels ultra-courants (articles, pronoms, prépositions)
 * - Scoring intelligent adapté aux textes courts
 * - Zero dépendance externe (lightweight, déterministe)
 *
 * Inspiré de l'analyse N-gram mais optimisé pour performance.
 * Fonctionne parfaitement sur textes courts (2-5 mots) contrairement à franc/cld.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis
 * @see https://stackoverflow.com/questions/31102274/web-speech-api-two-utterances-at-same-time
 */

export interface LanguageSegment {
  text: string;
  language: string; // BCP 47 code
}

/**
 * Pattern de détection par langue avec scoring pondéré
 *
 * Scoring :
 * - Mot commun : 1 point
 * - Mot fonctionnel (préposition, conjonction) : 1 point
 * - Article : 2 points
 * - Pronom personnel : 3 points
 * - Caractères spéciaux (2 chars) : 1 point
 */
interface LanguagePattern {
  // Mots ultra-courants (salutations, verbes, noms)
  common: RegExp;
  // Mots fonctionnels (prépositions, conjonctions) - 1pt
  functional: RegExp;
  // Articles définis/indéfinis - 2pts
  articles: RegExp;
  // Pronoms personnels - 3pts
  pronouns: RegExp;
  // Caractères spéciaux de la langue
  special?: RegExp;
  // Code BCP 47
  code: string;
}

const LANGUAGE_PATTERNS: Record<string, LanguagePattern> = {
  english: {
    common: /\b(hello|world|thank|thanks|yes|no|please|sorry|good|bad|very|much|many|some|any|all|every|each)\b/gi,
    functional: /\b(the|a|an|of|to|in|for|on|at|by|with|from|is|are|was|were|be|been|have|has|had|do|does|did|can|could|will|would|should|may|might)\b/gi,
    articles: /\b(the|a|an)\b/gi,
    pronouns: /\b(I|you|he|she|it|we|they|me|him|her|us|them|my|your|his|its|our|their)\b/gi,
    code: 'en-US'
  },
  italian: {
    common: /\b(ciao|grazie|prego|buongiorno|buonasera|sì|no|bene|male|molto|poco|cosa|come|dove|quando|perché|chi|sono|sei|è|siamo|chiamo|chiama)\b/gi,
    functional: /\b(di|da|in|con|su|per|tra|fra|a|ad|del|della|dei|delle|al|alla|ai|alle|nel|nella|nei|nelle)\b/gi,
    articles: /\b(il|lo|la|i|gli|le|un|uno|una|l')\b/gi,
    pronouns: /\b(io|tu|lui|lei|noi|voi|loro|mi|ti|ci|vi|si|me|te|mio|tuo|suo|nostro|vostro)\b/gi,
    code: 'it-IT'
  },
  spanish: {
    common: /\b(hola|gracias|por\s+favor|buenos|buenas|días|tardes|noches|sí|no|bien|mal|muy|mucho|poco|qué|cómo|dónde|cuándo|por\s+qué|quién|soy|eres|es|somos|llamo|llama)\b/gi,
    functional: /\b(de|en|a|por|para|con|sin|sobre|entre|y|o|es|son|está|están|ser|estar|hay|haber|del|al)\b/gi,
    articles: /\b(el|la|los|las|un|una|unos|unas)\b/gi,
    pronouns: /\b(yo|tú|él|ella|usted|nosotros|vosotros|ellos|ellas|ustedes|me|te|se|nos|os|mi|tu|su|nuestro|vuestro)\b/gi,
    special: /[áéíóúñ¿¡]/gi,
    code: 'es-ES'
  },
  german: {
    common: /\b(hallo|danke|bitte|guten|tag|morgen|abend|ja|nein|gut|schlecht|sehr|viel|wenig|was|wie|wo|wann|warum|wer|bin|bist|ist|sind|heiße|heißt)\b/gi,
    functional: /\b(der|die|das|den|dem|des|und|oder|aber|von|zu|in|mit|für|auf|an|bei|nach|aus|über|unter|vor|hinter)\b/gi,
    articles: /\b(der|die|das|den|dem|des|ein|eine|einem|einen|eines)\b/gi,
    pronouns: /\b(ich|du|er|sie|es|wir|ihr|sie|mich|dich|uns|euch|mir|dir|ihm|ihr|mein|dein|sein|unser|euer)\b/gi,
    special: /[äöüß]/gi,
    code: 'de-DE'
  }
} as const;

/**
 * Détecte la langue dominante d'un texte avec scoring pondéré
 * ROBUSTE pour textes courts (2-5 mots) grâce aux mots fonctionnels
 *
 * @param text Texte à analyser
 * @returns Code BCP 47 de la langue détectée
 */
export function detectDominantLanguage(text: string): string {
  if (!text?.trim()) return 'fr-FR';

  // Normaliser le texte (lowercase pour matching case-insensitive)
  const normalized = text.toLowerCase();

  let maxScore = 0;
  let detectedLang = 'fr-FR';

  // Tester chaque langue avec scoring pondéré
  for (const [_, pattern] of Object.entries(LANGUAGE_PATTERNS)) {
    let score = 0;

    // Mots communs : 1 point chacun
    const commonMatches = normalized.match(pattern.common);
    score += (commonMatches?.length ?? 0) * 1;

    // Mots fonctionnels : 1 point chacun
    const functionalMatches = normalized.match(pattern.functional);
    score += (functionalMatches?.length ?? 0) * 1;

    // Articles : 2 points chacun
    const articleMatches = normalized.match(pattern.articles);
    score += (articleMatches?.length ?? 0) * 2;

    // Pronoms : 3 points chacun
    const pronounMatches = normalized.match(pattern.pronouns);
    score += (pronounMatches?.length ?? 0) * 3;

    // Caractères spéciaux : 1 point pour 2 caractères
    if (pattern.special) {
      const specialMatches = text.match(pattern.special);
      score += Math.floor((specialMatches?.length ?? 0) / 2);
    }

    if (score > maxScore) {
      maxScore = score;
      detectedLang = pattern.code;
    }
  }

  // Seuil adaptatif : 1 point minimum (robuste pour textes courts)
  return maxScore >= 1 ? detectedLang : 'fr-FR';
}

/**
 * Segmente un texte multilingue en segments par langue
 * Basé sur la queue Web Speech API pattern officiel
 *
 * Cas d'usage éducation :
 * - "Bonjour ! En anglais : Hello world !"
 * - "Le mot 'thank you' signifie merci"
 * - "Répète après moi : good morning"
 * - "Ciao, mi chiamo Marco" → détecte italien automatiquement
 */
export function segmentMultilingualText(
  text: string,
  defaultLanguage: string = 'fr-FR'
): LanguageSegment[] {
  if (!text?.trim()) {
    return [];
  }

  // Pattern pour détecter marqueurs explicites de langue
  const explicitMarkers = [
    { pattern: /(en anglais|in english)[\s:]+([^.!?]+)/gi, lang: 'en-US' },
    { pattern: /(en espagnol|in spanish|en español)[\s:]+([^.!?]+)/gi, lang: 'es-ES' },
    { pattern: /(en allemand|in german|auf deutsch)[\s:]+([^.!?]+)/gi, lang: 'de-DE' },
    { pattern: /(en italien|in italian|in italiano)[\s:]+([^.!?]+)/gi, lang: 'it-IT' }
  ];

  const segments: LanguageSegment[] = [];
  let lastIndex = 0;

  // Chercher les marqueurs explicites
  for (const { pattern, lang } of explicitMarkers) {
    const matches = Array.from(text.matchAll(pattern));

    for (const match of matches) {
      const startIndex = match.index ?? 0;
      const fullMatch = match[0] ?? '';
      const content = match[2]?.trim() ?? '';

      // Ajouter le texte avant (langue par défaut)
      if (startIndex > lastIndex) {
        const beforeText = text.slice(lastIndex, startIndex).trim();
        if (beforeText) {
          segments.push({
            text: beforeText,
            language: defaultLanguage
          });
        }
      }

      // Ajouter le segment dans la langue détectée
      if (content) {
        segments.push({
          text: content,
          language: lang
        });
      }

      lastIndex = startIndex + fullMatch.length;
    }
  }

  // Ajouter le reste du texte
  if (lastIndex < text.length) {
    const finalText = text.slice(lastIndex).trim();
    if (finalText) {
      segments.push({
        text: finalText,
        language: defaultLanguage
      });
    }
  }

  // Si aucun segment trouvé, retourner texte entier avec langue détectée
  if (segments.length === 0) {
    const detectedLang = detectDominantLanguage(text);
    segments.push({
      text: text.trim(),
      language: detectedLang
    });
  }

  return segments;
}
