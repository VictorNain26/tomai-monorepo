/**
 * What a detected distress does beyond the fixed reply: the event kept for the parent's alert
 * (lot 3), and the session closed — the conversation stops there.
 */

import { chatMessageService } from './chat-message.service.js';
import type { DistressTurn } from './chat-turn.types.js';
import { distressEventsRepository } from './distress-events.repository.js';
import { studySessionsRepository } from './study-sessions.repository.js';
import { DISTRESS_REPLY, type DistressSource } from './distress.js';

async function closeForDistress(event: { userId: string; sessionId: string; source: DistressSource; selfharmScore: number | null }): Promise<void> {
  await distressEventsRepository.create({ userId: event.userId, sessionId: event.sessionId, detectedBy: event.source, selfharmScore: event.selfharmScore });
  await studySessionsRepository.update(event.sessionId, { status: 'completed', endedAt: new Date() });
}

/** Whether the session was closed for distress: any later message gets the fixed reply again. */
export async function closedForDistress(sessionId: string): Promise<boolean> {
  return distressEventsRepository.existsForSession(sessionId);
}

/**
 * The distress turn: the first distress of the session records the event and closes it, then the
 * student's message and the fixed reply are stored as they lived them.
 */
export async function answerDistress(params: { turn: DistressTurn; userId: string; content: string; inputMode?: 'text' | 'voice' | undefined }): Promise<void> {
  const { turn, userId } = params;
  // The event first: the parent's alert must not hang on the messages being saved.
  if (turn.source !== 'closed') await closeForDistress({ userId, sessionId: turn.sessionId, source: turn.source, selfharmScore: turn.selfharmScore });
  await chatMessageService.saveMessage(turn.sessionId, 'user', params.content, {
    distress: turn.source,
    ...(params.inputMode && { inputMode: params.inputMode }),
  }, { verifySessionExists: false });
  await chatMessageService.saveMessage(turn.sessionId, 'assistant', DISTRESS_REPLY, { distress: turn.source }, { verifySessionExists: false });
}
