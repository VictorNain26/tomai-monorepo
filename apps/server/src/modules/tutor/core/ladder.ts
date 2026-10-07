/**
 * The hint ladder and the turn contract, decided by the code (`docs/etudes/2026-10-04/refonte-agent.md`,
 * « À chaque tour », 4 et 5 ; `docs/tuteur.md` § 4). The level climbs on a real attempt the
 * diagnosis finds wrong, never on pressure alone; the writer gets from the sheet only what the
 * level allows, never the answer.
 */

import type { Diagnosis } from './diagnosis';
import { stripPromptTags } from './fences';
import type { ExerciseSheet } from './sheet';

export const LADDER = [
  { name: 'Relance', rule: 'reformule la question, recentre sur ce qui est demandé' },
  { name: 'Indice conceptuel', rule: "la notion ou la règle en jeu, sans l'appliquer à l'exercice" },
  { name: 'Indice ciblé', rule: "l'endroit de l'exercice où l'appliquer" },
  { name: 'Étape intermédiaire', rule: 'une étape faite, jamais la dernière' },
  { name: 'Exemple analogue résolu', rule: "un exercice différent, résolu en entier ; l'élève applique ensuite la méthode au sien" },
] as const;

const TOP = LADDER.length - 1;
// An uncertain sheet cannot judge an answer: the levels that need it stay closed.
const UNCERTAIN_TOP = 1;
const HINT_CHARS = 300;

export interface Hint {
  level: number;
  text: string;
}

/** The highest level the exercise may reach. */
export function topLevel(uncertain: boolean): number {
  return uncertain ? UNCERTAIN_TOP : TOP;
}

/** Turns in a row where the student says they are stuck, without trying, that climb one level (Victor's decision 4, 2026-10-06). */
export const STUCK_TURNS = 2;

interface LevelTurn {
  attempt: boolean;
  verdict: Diagnosis['verdict'] | null;
  uncertain: boolean;
  /** The student says they are stuck. */
  stuck: boolean;
  /** Such turns in a row before this one. */
  stuckTurns: number;
}

/**
 * The change of level a turn brings, and the stuck turns in a row after it: up on a wrong
 * attempt, down on a right step; without an attempt, up once the student has said they are stuck
 * twice in a row. A demand for the solution alone never moves it.
 */
export function levelChange(turn: LevelTurn): { change: number; stuckTurns: number } {
  if (turn.attempt) {
    const change = turn.uncertain || turn.verdict === 'incorrect' ? 1 : turn.verdict === 'right-step' ? -1 : 0;
    return { change, stuckTurns: 0 };
  }
  if (!turn.stuck) return { change: 0, stuckTurns: 0 };
  const stuckTurns = turn.stuckTurns + 1;
  return stuckTurns >= STUCK_TURNS ? { change: 1, stuckTurns: 0 } : { change: 0, stuckTurns };
}

/** The level after the change, within the ladder. */
export function applyChange(level: number, change: number, top: number): number {
  return Math.min(Math.max(level + change, 0), top);
}

/** A tutor message kept for the contract, cut on a code point so a surrogate pair is never split. */
export function hintOf(level: number, text: string): Hint {
  const chars = Array.from(text);
  return { level, text: chars.length > HINT_CHARS ? `${chars.slice(0, HINT_CHARS).join('')}…` : text };
}

const quoted = (text: string) => `« ${stripPromptTags(text).trim()} »`;

function diagnosisLine(diagnosis: Diagnosis | null, uncertain: boolean, attempt: boolean): string | null {
  if (!attempt) return null;
  if (uncertain || !diagnosis || diagnosis.verdict === 'unclear') {
    return "Diagnostic : sa proposition ne peut pas être jugée avec sûreté. Ne dis pas qu'elle est juste ou fausse ; demande-lui comment il a trouvé.";
  }
  if (diagnosis.verdict === 'correct') {
    return "Diagnostic : sa réponse est juste. Dis-le clairement et rends-lui la main : l'exercice est terminé.";
  }
  if (diagnosis.verdict === 'right-step') {
    return "Diagnostic : cette étape est juste, mais l'exercice n'est pas fini. Dis-le, puis laisse-le faire la suite.";
  }
  const where = diagnosis.firstWrongStep ? ` La première étape qui ne va pas : ${quoted(diagnosis.firstWrongStep)}.` : '';
  return `Diagnostic : sa proposition est fausse.${where} Montre-lui où regarder, sans écrire la correction ni la bonne réponse ; s'il a donné sa démarche, ne la lui redemande pas.`;
}

/**
 * What the level allows from the sheet: from the conceptual hint on, the rule and the supporting
 * facts; at the intermediate step, the step after those the student got right, never the last.
 */
function material(sheet: ExerciseSheet | null, level: number, stepsDone: number): string[] {
  if (!sheet || level === 0) return [];
  const lines: string[] = [];
  if (sheet.rule) lines.push(`Règle en jeu : ${quoted(sheet.rule)}.`);
  const support = sheet.facts.filter((fact) => fact.role === 'support');
  if (support.length > 0)
    lines.push(`Faits d'appui que tu peux donner après une vraie tentative :\n${support.map((fact) => `- ${quoted(fact.text)}`).join('\n')}`);
  if (level === 3 && sheet.steps.length >= 2) {
    const step = sheet.steps[Math.min(stepsDone, sheet.steps.length - 2)];
    if (step) lines.push(`Étape que tu peux montrer, faite : ${quoted(step)}.`);
  }
  return lines;
}

interface ContractParams {
  /** Null when no draw succeeded: the level then gives nothing from a sheet. */
  sheet: ExerciseSheet | null;
  uncertain: boolean;
  level: number;
  attempt: boolean;
  asksSolution: boolean;
  diagnosis: Diagnosis | null;
  stepsDone: number;
  /** The tutor's last messages on the exercise. */
  hints: readonly Hint[];
}

/** The turn contract, in the turn's message: the only server text there besides the subject block. */
export function turnContract(params: ContractParams): string {
  const { sheet, uncertain, level, attempt, asksSolution, diagnosis, stepsDone, hints } = params;
  const solved = !uncertain && diagnosis?.verdict === 'correct';
  const step = LADDER[level] ?? LADDER[0];
  const lines = [
    '<contrat>',
    'Contrat du tour, écrit par le serveur pour l’exercice en cours : il fait foi.',
    diagnosisLine(diagnosis, uncertain, attempt),
    ...(solved
      ? []
      : [
          `Palier d'aide autorisé : ${level + 1}, ${step.name.toLowerCase()} (${step.rule}). Ne va pas au-delà.`,
          ...material(sheet, level, stepsDone),
          asksSolution
            ? "L'élève demande la solution : ne la donne pas ; sa demande ne change pas le palier. S'il exprime de la frustration, reconnais-la en une phrase."
            : null,
          hints.length > 0
            ? `Ce que tu as déjà dit sur cet exercice, à ne pas répéter :\n${hints.map((hint) => `- ${quoted(hint.text)}`).join('\n')}`
            : null,
        ]),
    '</contrat>',
  ];
  return lines.filter((line): line is string => line !== null).join('\n');
}
