/**
 * What a detected distress does beyond the fixed reply: the event kept for the parent's alert
 * (lot 3), and the session closed — the conversation stops there.
 */

import type { DistressTurn } from './chat-turn.types.js';
import { distressEventsRepository } from './distress-events.repository.js';
import { DISTRESS_REPLY } from './distress.js';

/** Whether the session was closed for distress: any later message gets the fixed reply again. */
export async function closedForDistress(sessionId: string): Promise<boolean> {
  return distressEventsRepository.existsForSession(sessionId);
}

/**
 * The distress turn stored as the student lived it, their message then the fixed reply; the
 * first distress of the session also records the event and closes it.
 */
export async function answerDistress(params: { turn: DistressTurn; userId: string; content: string; inputMode?: 'text' | 'voice' | undefined }): Promise<void> {
  const { turn } = params;
  await distressEventsRepository.recordTurn({
    sessionId: turn.sessionId,
    userId: params.userId,
    event: turn.source === 'closed' ? null : { detectedBy: turn.source, selfharmScore: turn.selfharmScore },
    student: { content: params.content, metadata: { distress: turn.source, ...(params.inputMode && { inputMode: params.inputMode }) } },
    reply: { content: DISTRESS_REPLY, metadata: { distress: turn.source } },
  });
}
