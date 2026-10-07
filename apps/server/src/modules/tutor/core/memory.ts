/**
 * The learner memory (`docs/etudes/2026-10-07/memoire-entre-seances.md`): what the student's past
 * exercises say of each notion of the programme, written by the server, never by the model. No
 * text of the student enters it: the referential's wording, numbers and error types of a closed
 * list.
 */

import { notionText, schoolYearOf } from './sheet';

/** The first of September that opened the school year, at midnight in Paris (summer time, UTC+2). */
export const schoolYearStart = (now: Date) => new Date(Date.UTC(schoolYearOf(now), 7, 31, 22));

export interface PastExercise {
  createdAt: Date;
  entries: readonly string[];
  hintLevel: number;
  solved: boolean;
  /** The error types of its turns, in order. */
  errorTypes: readonly string[];
}

const ERROR_LABELS: Partial<Record<string, string>> = {
  guess: 'répond au hasard ou sans comprendre',
  misinterpret: 'comprend mal la consigne',
  careless: "fait des erreurs d'inattention",
  'right-idea': "a la bonne idée sans aller jusqu'au bout",
  imprecise: 'manque de précision',
};

export interface NotionMemory {
  notionId: string;
  label: string;
  worked: number;
  lastHintLevel: number;
  lastSolved: boolean;
  /** The error type seen at least twice, the most often; null otherwise. */
  frequentError: string | null;
}

/**
 * Each notion of the past exercises, oldest first in, the exercises before a correction of the
 * student (`resets`, a notion and its date) left out. A notion the referential no longer knows is
 * dropped.
 */
export function notionMemories(past: readonly PastExercise[], resets: ReadonlyMap<string, Date>): NotionMemory[] {
  const byNotion = new Map<string, PastExercise[]>();
  for (const exercise of past) {
    for (const notionId of exercise.entries) {
      const reset = resets.get(notionId);
      if (reset && exercise.createdAt <= reset) continue;
      byNotion.set(notionId, [...(byNotion.get(notionId) ?? []), exercise]);
    }
  }
  return [...byNotion].flatMap(([notionId, exercises]) => {
    const label = notionText(notionId);
    const last = exercises.at(-1);
    if (!label || !last) return [];
    return [
      {
        notionId,
        label,
        worked: exercises.length,
        lastHintLevel: last.hintLevel,
        lastSolved: last.solved,
        frequentError: frequentError(exercises.flatMap((exercise) => exercise.errorTypes)),
      },
    ];
  });
}

function frequentError(types: readonly string[]): string | null {
  const counts = new Map<string, number>();
  for (const type of types) if (ERROR_LABELS[type]) counts.set(type, (counts.get(type) ?? 0) + 1);
  const [top] = [...counts].sort(([, a], [, b]) => b - a);
  return top && top[1] >= 2 ? top[0] : null;
}

const line = ({ label, worked, lastHintLevel, lastSolved, frequentError: error }: NotionMemory) =>
  [
    `- ${label} : travaillée ${String(worked)} fois`,
    `la dernière fois, ${lastSolved ? 'résolue' : 'pas résolue'}, avec de l'aide jusqu'au palier ${String(lastHintLevel)}`,
    ...(error ? [`erreur fréquente : ${ERROR_LABELS[error] ?? error}`] : []),
  ].join(' ; ');

/** The block for the exercise's notions, null when the student's past says nothing of them. */
export function learnerMemoryBlock(notions: readonly string[], memories: readonly NotionMemory[]): string | null {
  const known = memories.filter((memory) => notions.includes(memory.notionId));
  if (known.length === 0) return null;
  return [
    '<learner_memory>',
    "Ce que le serveur sait des exercices de l'élève sur ces notions depuis la rentrée ; aucun texte de l'élève n'y entre :",
    ...known.map(line),
    "Sers-t'en pour doser ton aide et guetter cette erreur. Tu peux le rappeler simplement (« la dernière fois, ça avait résisté ici »), jamais comme un souvenir personnel, et sans rien dire d'autre de l'élève.",
    '</learner_memory>',
  ].join('\n');
}
