/**
 * The learner memory (`docs/etudes/2026-10-07/memoire-entre-seances.md`): what the student's past
 * exercises say of each notion of the programme, written by the server, never by the model. No
 * text of the student enters it: the referential's wording, numbers and error types of a closed
 * list.
 */

import type { Diagnosis } from './diagnosis';
import { LADDER } from './ladder';
import { notionText, schoolYearOf } from './sheet';

/** The first of September that opened the school year, at midnight in Paris (summer time, UTC+2). */
export const schoolYearStart = (now: Date) => new Date(Date.UTC(schoolYearOf(now), 7, 31, 22));

export interface PastExercise {
  /** Its order among all exercises: positions only grow. */
  position: number;
  entries: readonly string[];
  hintLevel: number;
  solved: boolean;
  /** The error types of its turns, in no particular order. */
  errorTypes: readonly string[];
}

// Every error the diagnosis names, but its « not sure » and « none »: a renamed type fails the typecheck here.
const ERROR_TYPES = {
  guess: 'répond au hasard ou sans comprendre',
  misinterpret: 'comprend mal la consigne',
  careless: "fait des erreurs d'inattention",
  'right-idea': "a la bonne idée sans aller jusqu'au bout",
  imprecise: 'manque de précision',
} satisfies Record<Exclude<Diagnosis['errorType'], 'not-sure' | 'n/a'>, string>;
const ERROR_LABELS: Partial<Record<string, string>> = ERROR_TYPES;

// The same errors, as the student reads them on what Tom keeps.
const TO_WATCH = {
  guess: 'répondre au hasard',
  misinterpret: 'mal lire la consigne',
  careless: "les erreurs d'inattention",
  'right-idea': "la bonne idée, pas menée jusqu'au bout",
  imprecise: 'le manque de précision',
} satisfies Record<keyof typeof ERROR_TYPES, string>;
const WATCH_LABELS: Partial<Record<string, string>> = TO_WATCH;

/** The level of help by its name on the ladder, as the turn's contract names it. */
const helpName = (level: number) => (LADDER[level] ?? LADDER[0]).name;

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
 * student (`resets`, a notion and the last position it covers) left out. A notion the referential no longer knows is
 * dropped.
 */
export function notionMemories(past: readonly PastExercise[], resets: ReadonlyMap<string, number>): NotionMemory[] {
  const byNotion = new Map<string, PastExercise[]>();
  for (const exercise of past) {
    for (const notionId of exercise.entries) {
      const reset = resets.get(notionId);
      if (reset !== undefined && exercise.position <= reset) continue;
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

/** The error type seen at least twice, the most often; a tie goes to the type listed first, whatever the order of the turns. */
function frequentError(types: readonly string[]): string | null {
  let top: string | null = null;
  let topCount = 1;
  for (const type of Object.keys(ERROR_TYPES)) {
    const count = types.filter((seen) => seen === type).length;
    if (count > topCount) [top, topCount] = [type, count];
  }
  return top;
}

const line = ({ label, worked, lastHintLevel, lastSolved, frequentError: error }: NotionMemory) =>
  [
    `- ${label} : travaillée ${String(worked)} fois`,
    `la dernière fois, ${lastSolved ? 'résolue' : 'pas résolue'}, avec de l'aide jusqu'à : ${helpName(lastHintLevel).toLowerCase()}`,
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

// The help of each step of the ladder, as a student says it: never the ladder's own names.
// A step added to the ladder without its words fails the typecheck here: a mapped type over a
// generic tuple keeps it a tuple, of the ladder's length.
type InWords<Steps extends readonly unknown[]> = { readonly [Step in keyof Steps]: string };
const HELP_IN_WORDS: InWords<typeof LADDER> = [
  'sans indice',
  'avec un rappel de la règle',
  'avec un indice',
  'avec une étape faite ensemble',
  'avec un exemple résolu',
];
const helpInWords = (level: number) => HELP_IN_WORDS[level] ?? HELP_IN_WORDS[0];

/** A notion as the student, and the summary of the week, read it: the help and the error to watch in their words. */
export const notionView = ({ notionId, label, worked, lastHintLevel, lastSolved, frequentError: error }: NotionMemory) => ({
  notionId,
  label,
  worked,
  lastSolved,
  lastHelp: helpInWords(lastHintLevel),
  watch: (error && WATCH_LABELS[error]) ?? null,
});
