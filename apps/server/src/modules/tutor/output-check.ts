/**
 * The check of what reaches the student — the tutor's message, the revision cards, the session
 * title (`docs/etudes/2026-10-04/refonte-agent.md`, « À chaque tour », 7): the exercise's answer
 * and its forms, as the evaluation harness looks for them; the prompt's tags; the written
 * equalities, recomputed by mathjs; Mistral's moderation.
 */

import { findLeakForm } from '../../lib/leak.js';
import { logger } from '../../platform/observability/logger.js';
import { moderateReply, moderateTexts } from '../../platform/ai/moderation.js';
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

export type Finding =
  | { kind: 'answer' }
  | { kind: 'tag' }
  | { kind: 'equality'; quote: string }
  | { kind: 'moderation'; categories: string[] }
  /** Moderation could not answer: nothing reaches the student unchecked. */
  | { kind: 'unmoderated' };

/**
 * The forms of the answer the message must not hold. A form the statement holds is no leak
 * (« 5 » in « 3x + 5 = 20 »). When the diagnosis finds the student's answer right, the student
 * wrote the answer: the tutor may confirm it, in any of its forms. An uncertain sheet's answer is
 * not one to hold the tutor to.
 */
function watchedForms(ctx: OutputCheckContext): string[] {
  const { sheet } = ctx;
  if (!sheet || ctx.uncertain || sheet.kind !== 'short' || ctx.diagnosis?.verdict === 'correct') return [];
  const forms = [...new Set([sheet.answer, ...sheet.answerForms].filter((form): form is string => Boolean(form?.trim())))];
  return forms.filter((form) => !findLeakForm(sheet.statement, [form]));
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

const moderationFindings = (categories: string[]): Finding[] => (categories.length > 0 ? [{ kind: 'moderation', categories }] : []);

function unmoderated(err: unknown, what: string): Finding[] {
  logger.error('Moderation unavailable', { operation: 'moderation:error', what, err, severity: 'high' as const });
  return [{ kind: 'unmoderated' }];
}

/** The tutor's message checked whole: the deterministic checks and the moderation, at once. */
export async function checkReply(text: string, ctx: OutputCheckContext): Promise<Finding[]> {
  const moderation = moderateReply(ctx.studentText, text).then(moderationFindings, (err: unknown) => unmoderated(err, 'reply'));
  return [...checkOutput(text, ctx), ...(await moderation)];
}

/** Whether a session title may be stored. */
export async function titlePasses(title: string, ctx: OutputCheckContext): Promise<boolean> {
  if (checkOutput(title, ctx).length > 0) return false;
  const moderation = await moderateTexts([title]).then(([categories]) => moderationFindings(categories ?? []), (err: unknown) => unmoderated(err, 'title'));
  return moderation.length === 0;
}

/**
 * What the regeneration is told: what was held back, never the first text nor the answer, which
 * the writer must not see.
 */
export function regenerationInstruction(findings: readonly Finding[]): string {
  const lines = findings.map((finding) => {
    if (finding.kind === 'answer') return "Elle donnait la réponse de l'exercice, ou l'une de ses formes : ne l'écris pas, même pour vérifier.";
    if (finding.kind === 'tag') return "Elle contenait une balise interne : n'écris que ce qui s'adresse à l'élève.";
    if (finding.kind === 'moderation' || finding.kind === 'unmoderated') return "Elle a été retenue par la modération : écris une réponse qui convient à un élève de collège.";
    return `Elle contenait une égalité fausse, « ${finding.quote} » : ne l'écris pas, et refais chaque calcul que tu écris.`;
  });
  return `<critical_instruction>\nUne première réponse à ce tour a été retenue par le serveur, l'élève ne l'a pas vue. Écris-en une nouvelle.\n${[...new Set(lines)].join('\n')}\n</critical_instruction>`;
}

/** What the student reads when the regeneration fails the check too. */
export const FALLBACK_REPLY = "Je reprends autrement : dis-moi où tu en es dans l'exercice, et on avance ensemble à partir de là.";
