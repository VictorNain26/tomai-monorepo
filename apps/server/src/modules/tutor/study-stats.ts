import { studySessionsRepository } from './study-sessions.repository.js';

export function getStudyStats(userId: string) {
  return studySessionsRepository.getSessionStats(userId);
}
