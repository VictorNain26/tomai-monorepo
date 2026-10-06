/** The shapes of a chat turn: what `prepareTurn` gathers and what `finishTurn` records. */

import type { LanguageModelUsage } from 'ai';
import type { AttachedFileInfo, AttachedFileForPrompt } from '../documents/index.js';
import type { EducationLevelType } from '../../types/index.js';
import type { SubjectFamily, SubjectSlug } from '../../lib/subjects.js';
import type { HistoryTurn, ResponseMessage } from './chat-message-assembler.js';
import type { OutputCheckRecord } from './chat-message.service.js';
import type { OutputCheckContext } from './output-check.js';
import type { Diagnosis } from './exercise-diagnosis.service.js';
import type { ExerciseSheet } from './exercise-sheet.js';
import type { ExerciseChange } from './exercise-turn.js';
import type { TurnAnalysis } from './turn-analysis.service.js';
import type { DistressSource } from './distress.js';

export interface PrepareTurnRequest {
  userId: string;
  sessionId?: string | undefined;
  requestedSubject?: SubjectSlug | undefined;
  content: string;
  fileIds: string[];
  schoolLevel: EducationLevelType;
  /** The plan includes the revision cards; null when it could not be read (no notice then). */
  flashcards: boolean | null;
}

/** @public — reachable only via the typed client's inferred route return types (apps/server build:types), not a direct import; knip false positive. */
export interface ChatTurnContext {
  kind: 'tutor';
  /** The categories input moderation flagged, kept with the message; null when it could not answer, absent without text. */
  inputModeration?: string[] | null;
  sessionId: string;
  subject?: SubjectFamily;
  conversationSummary: string | null;
  conversationHistory: HistoryTurn[];
  turnInstruction: string | null;
  turnAnalysis: TurnAnalysis;
  /** The exercise in progress: prepared when the student brings one, else the session's, unless solved. */
  exerciseSheet: ExerciseSheet | null;
  /** The sheet's answer is not one to hold the tutor to. */
  exerciseUncertain: boolean;
  /** The exercise's progress under a contract, for `finishTurn` to keep the tutor's message. */
  exerciseProgress: ExerciseProgress | null;
  /** The turn's files the user may attach: their own, uploaded, each once. */
  fileIds: string[];
  /** The bounded texts of the session's files, then of this turn's, for `streamChat`'s `attachedFiles`. */
  attachedFiles: AttachedFileForPrompt[];
  attachedFileInfo: AttachedFileInfo | null;
  attachedFileInfos?: AttachedFileInfo[];
}

export interface PersistUserTurnParams {
  sessionId: string;
  content: string;
  inputMode?: 'text' | 'voice' | undefined;
  fileIds: string[];
  attachedFileInfo: AttachedFileInfo | null;
  attachedFileInfos?: AttachedFileInfo[] | undefined;
  inputModeration?: string[] | null | undefined;
}

export interface FinishTurnParams {
  sessionId: string;
  userId: string;
  userContent: string;
  /** The text the student read. */
  text: string;
  /** The turn's response messages as the model produced them, reasoning and tool calls included. */
  modelMessages?: ResponseMessage[] | undefined;
  /** The turn was cut (timeout, error): its response messages miss what the student saw of the last call. */
  aborted?: boolean | undefined;
  model: string;
  usage: LanguageModelUsage | undefined;
  startTime: number;
  attachedFileInfo: AttachedFileInfo | null;
  attachedFileInfos?: AttachedFileInfo[] | undefined;
  turnAnalysis: TurnAnalysis;
  exerciseProgress?: ExerciseProgress | null | undefined;
  /** What the check before the student held back, when it did. */
  outputCheck?: OutputCheckRecord | undefined;
  /** What the session title is checked against. */
  check: OutputCheckContext;
}

interface ExerciseProgress {
  id: string | null;
  hintLevel: number;
  diagnosis: Diagnosis | null;
  change: ExerciseChange;
}

/** A turn the code answers with the fixed distress reply, without the model. */
export interface DistressTurn {
  kind: 'distress';
  sessionId: string;
  /** Who saw the distress, or `closed` for a message in a session distress already closed. */
  source: DistressSource | 'closed';
  selfharmScore: number | null;
}
