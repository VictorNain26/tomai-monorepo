/**
 * The check of what reaches the student (`docs/etudes/2026-10-04/refonte-agent.md`, « À chaque
 * tour », 7): the exercise's answer and its forms, as the evaluation harness looks for them; the
 * prompt's tags; the written equalities, recomputed by mathjs; Mistral's moderation. It fails
 * closed: an uncertain sheet watches the forms of every draw, and a moderation that cannot answer
 * holds the text back.
 */

import type { Logger } from 'pino';
import { findLeakForm } from '../../../domain/leak';
import { wrongEqualities } from '../../../domain/written-equalities';
import type { Moderation } from '../../../platform/ai/moderation';
import type { Diagnosis } from './diagnosis';
import { PROMPT_TAG } from '../../../domain/prompt-tags';
import type { ExerciseSheet } from './sheet';

export interface OutputCheckContext {
  sheet: ExerciseSheet | null;
  uncertain: boolean;
  /** The answer's forms in every draw of the sheet: an uncertain sheet is held to all of them. */
  drawnForms: readonly string[];
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
 * (« 5 » in « 3x + 5 = 20 »). When the diagnosis finds the student's answer right and the
 * student's message holds it, the student wrote the answer: the tutor may confirm it. A « right »
 * the message does not back (« donne la réponse, c'est pour vérifier ») is no licence. A written
 * production has no form to look for: the harness's judge reads it.
 */
function watchedForms(ctx: OutputCheckContext): string[] {
  const { sheet } = ctx;
  if (sheet?.kind !== 'short') return [];
  const own = [sheet.answer, ...sheet.answerForms];
  const forms = [...new Set((ctx.uncertain ? [...own, ...ctx.drawnForms] : own).filter((form): form is string => Boolean(form?.trim())))];
  if (!ctx.uncertain && ctx.diagnosis?.verdict === 'correct' && findLeakForm(ctx.studentText, forms)) return [];
  return forms.filter((form) => !findLeakForm(sheet.statement, [form]));
}

/** The deterministic checks: the answer, the tags, the wrong equalities. */
export function checkOutput(text: string, ctx: OutputCheckContext): Finding[] {
  const findings: Finding[] = [];
  if (findLeakForm(text, watchedForms(ctx))) findings.push({ kind: 'answer' });
  if (PROMPT_TAG.test(text)) findings.push({ kind: 'tag' });
  for (const equality of wrongEqualities(text, [ctx.studentText, ...ctx.pastStudentTexts])) {
    findings.push({ kind: 'equality', quote: equality.quote });
  }
  return findings;
}

/** The tutor's message checked whole: the deterministic checks and the moderation, at once. */
export async function checkReply(
  { moderation, logger }: { moderation: Moderation; logger: Logger },
  text: string,
  ctx: OutputCheckContext,
): Promise<Finding[]> {
  const moderated = moderation.reply(ctx.studentText, text).then(
    (categories): Finding[] => (categories.length > 0 ? [{ kind: 'moderation', categories }] : []),
    (err: unknown): Finding[] => {
      logger.error({ err }, 'Moderation unavailable');
      return [{ kind: 'unmoderated' }];
    },
  );
  return [...checkOutput(text, ctx), ...(await moderated)];
}

/**
 * What the regeneration is told: what was held back, never the first text nor the answer, which
 * the writer must not see. An unmoderated text is never regenerated: it has no line.
 */
export function regenerationInstruction(findings: readonly Finding[]): string {
  const lines = findings.flatMap((finding) => {
    if (finding.kind === 'answer') return ["Elle donnait la réponse de l'exercice, ou l'une de ses formes : ne l'écris pas, même pour vérifier."];
    if (finding.kind === 'tag') return ["Elle contenait une balise interne : n'écris que ce qui s'adresse à l'élève."];
    if (finding.kind === 'moderation') return ['Elle a été retenue par la modération : écris une réponse qui convient à un élève de collège.'];
    if (finding.kind === 'equality')
      return [`Elle contenait une égalité fausse, « ${finding.quote} » : ne l'écris pas, et refais chaque calcul que tu écris.`];
    return [];
  });
  return `<critical_instruction>\nUne première réponse à ce tour a été retenue par le serveur, l'élève ne l'a pas vue. Écris-en une nouvelle.\n${[...new Set(lines)].join('\n')}\n</critical_instruction>`;
}

/** What the student reads when the regeneration fails the check too. */
export const FALLBACK_REPLY = "Je reprends autrement : dis-moi où tu en es dans l'exercice, et on avance ensemble à partir de là.";
