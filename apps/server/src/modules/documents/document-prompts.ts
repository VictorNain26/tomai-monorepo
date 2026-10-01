import type { EducationLevelType } from '../../types/education.types.js';

export const DOCUMENT_PROMPT_VERSION = '2026-09-22';

const LEVEL_NAMES: Record<EducationLevelType, string> = {
  cp: 'CP', ce1: 'CE1', ce2: 'CE2', cm1: 'CM1', cm2: 'CM2',
  sixieme: '6ème', cinquieme: '5ème', quatrieme: '4ème', troisieme: '3ème',
  seconde: 'Seconde', premiere: 'Première', terminale: 'Terminale'
};

export function buildSystemPrompt(
  schoolLevel: EducationLevelType,
  userQuestion?: string
): string {
  const levelText = LEVEL_NAMES[schoolLevel] ?? schoolLevel;

  let prompt = `Tu es Tom, tuteur pédagogique expert pour élèves français de ${levelText}.

## RÈGLES PÉDAGOGIQUES
- Utilise l'enseignement EXPLICITE pour les définitions
- Notation KaTeX ($$formule$$) pour les mathématiques
- Ton professionnel et bienveillant
- Pour les exercices: guide par questions socratiques, NE DONNE PAS la solution directement
- Pour les cours: explique les concepts clés avec exemples`;

  if (userQuestion) {
    prompt += `

## QUESTION DE L'ÉLÈVE
${userQuestion}

Réponds à cette question en priorité dans ton analyse.`;
  }

  return prompt;
}

export function buildUserPrompt(
  documentText: string,
  schoolLevel: EducationLevelType,
  userQuestion?: string
): string {
  let prompt = `Analyse ce document.

## DOCUMENT
"""
${documentText}
"""

Niveau de l'élève: ${schoolLevel}`;

  if (userQuestion) {
    prompt += `\n\nQuestion spécifique: ${userQuestion}`;
  }

  return prompt;
}

export function buildImagePrompt(
  schoolLevel: EducationLevelType,
  userQuestion?: string
): string {
  let prompt = `Analyse cette image.

TÂCHE:
1. Extrais TOUT le texte visible (OCR)
2. Classifie le document (type + matière)
3. Fournis une analyse pédagogique adaptée

Niveau de l'élève: ${schoolLevel}`;

  if (userQuestion) {
    prompt += `\n\nQuestion spécifique de l'élève: ${userQuestion}`;
  }

  return prompt;
}
