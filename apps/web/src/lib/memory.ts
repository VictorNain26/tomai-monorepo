/** What Tom keeps of the student (`/api/memory`), in the words the student reads. */

import { queryOptions } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';
import { api, isProblem, parseResponse } from './api';

export type Memory = InferResponseType<typeof api.memory.$get, 200>;
type Notion = Memory['notions'][number];

export const memoryQuery = queryOptions({
  queryKey: ['memory'],
  queryFn: () => parseResponse(api.memory.$get()),
});

const ERRORS: Partial<Record<string, string>> = {
  guess: 'répondre au hasard',
  misinterpret: 'mal lire la consigne',
  careless: "les erreurs d'inattention",
  'right-idea': "la bonne idée, pas menée jusqu'au bout",
  imprecise: 'le manque de précision',
};

/** « Travaillée 2 fois. La dernière fois : pas résolue, aide jusqu'au palier 3. À surveiller : mal lire la consigne. » */
export function notionSummary({ worked, lastSolved, lastHintLevel, frequentError }: Notion): string {
  const watch = frequentError ? ERRORS[frequentError] : undefined;
  return [
    `Travaillée ${String(worked)} fois.`,
    `La dernière fois : ${lastSolved ? 'résolue' : 'pas résolue'}, aide jusqu'au palier ${String(lastHintLevel)}.`,
    ...(watch ? [`À surveiller : ${watch}.`] : []),
  ].join(' ');
}

/** A failed memory request, in words a student reads. */
export function memoryMessage(error: unknown): string {
  if (isProblem(error, 'FORBIDDEN')) return 'Ton parent ne te l’a pas proposée : demande-lui.';
  if (isProblem(error, 'RATE_LIMITED')) return 'Trop d’essais. Attends une minute.';
  return 'Ça n’a pas marché. Réessaie dans un instant.';
}
