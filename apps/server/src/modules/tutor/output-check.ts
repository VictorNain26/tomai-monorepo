/**
 * The deterministic check of the tutor's message before the student sees it
 * (`docs/etudes/2026-10-04/refonte-agent.md`, « À chaque tour », 7): the exercise's answer and its
 * forms, as the evaluation harness looks for them; the prompt's tags; the written equalities,
 * recomputed by mathjs.
 */

import { findLeakForm } from '../../lib/leak.js';
import { PROMPT_TAG } from '../../lib/prompt-tags.js';
import { wrongEqualities } from '../../lib/written-equalities.js';
import type { Diagnosis } from './exercise-diagnosis.service.js';
import type { ExerciseSheet } from './exercise-sheet.js';

export interface OutputCheckContext {
  sheet: ExerciseSheet | null;
  uncertain: boolean;
  diagnosis: Diagnosis | null;
  /** This turn's student message. */
  studentText: string;
  /** The student's earlier messages of the window: an equality they wrote is their work, quoted back. */
  pastStudentTexts: readonly string[];
}

export type Finding = { kind: 'answer' } | { kind: 'tag' } | { kind: 'equality'; quote: string };

/**
 * The forms of the answer the message must not hold. A form the statement holds is no leak
 * (« 5 » in « 3x + 5 = 20 »); one the student wrote, when the diagnosis finds it right, may be
 * taken up to confirm it. An uncertain sheet's answer is not one to hold the tutor to.
 */
function watchedForms(ctx: OutputCheckContext): string[] {
  const { sheet } = ctx;
  if (!sheet || ctx.uncertain || sheet.kind !== 'short') return [];
  const forms = [...new Set([sheet.answer, ...sheet.answerForms].filter((form): form is string => Boolean(form?.trim())))];
  const confirmed = ctx.diagnosis?.verdict === 'correct';
  return forms.filter((form) => !findLeakForm(sheet.statement, [form]) && !(confirmed && findLeakForm(ctx.studentText, [form])));
}

export function checkOutput(text: string, ctx: OutputCheckContext): Finding[] {
  const findings: Finding[] = [];
  if (findLeakForm(text, watchedForms(ctx))) findings.push({ kind: 'answer' });
  if (PROMPT_TAG.test(text)) findings.push({ kind: 'tag' });
  for (const equality of wrongEqualities(text, [ctx.studentText, ...ctx.pastStudentTexts])) {
    findings.push({ kind: 'equality', quote: equality.quote });
  }
  return findings;
}

/**
 * What the regeneration is told: what was held back, never the answer itself, which the writer
 * must not see.
 */
export function regenerationInstruction(findings: readonly Finding[]): string {
  const lines = findings.map((finding) => {
    if (finding.kind === 'answer') return "Elle donnait la réponse de l'exercice, ou l'une de ses formes : ne l'écris pas, même pour vérifier.";
    if (finding.kind === 'tag') return "Elle contenait une balise interne : n'écris que ce qui s'adresse à l'élève.";
    return `Elle contenait une égalité fausse, « ${finding.quote} » : ne l'écris pas, et refais chaque calcul que tu écris.`;
  });
  return `<critical_instruction>\nTa réponse précédente a été retenue par le serveur, l'élève ne l'a pas vue. Réécris-la.\n${[...new Set(lines)].join('\n')}\n</critical_instruction>`;
}

/** What the student reads when the regeneration fails the check too. */
export const FALLBACK_REPLY = "Je reprends autrement : dis-moi où tu en es dans l'exercice, et on avance ensemble à partir de là.";
