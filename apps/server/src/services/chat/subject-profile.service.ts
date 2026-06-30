import { studentSubjectProfileRepository } from '../../db/repositories/student-subject-profile.repository.js';
import { STUDENT_SUBJECTS } from '../../config/prompts/adaptation/subjects.js';
import { logger } from '../../lib/observability.js';

const SUBJECT_PROFILE_TTL_DAYS = 180;
const PROMPT_CONCEPTS = 12;
const PROMPT_DIFFICULTIES = 6;

function isRealSubject(subject: string): boolean {
  return (STUDENT_SUBJECTS as readonly string[]).includes(subject) && subject !== 'general';
}

class SubjectProfileService {
  async aggregateFromEpisode(input: {
    userId: string;
    subject: string;
    conceptsCovered: string[];
    outcome?: string;
  }): Promise<void> {
    if (!isRealSubject(input.subject)) return;
    try {
      await studentSubjectProfileRepository.upsertAggregate({
        userId: input.userId,
        subject: input.subject,
        addedConcepts: input.conceptsCovered ?? [],
        addedDifficulties: [],
        outcome: input.outcome,
        ttlDays: SUBJECT_PROFILE_TTL_DAYS,
      });
    } catch (err) {
      logger.warn('Subject profile aggregation failed', {
        operation: 'subject-profile:aggregate',
        _error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async getMemory(userId: string) {
    const rows = await studentSubjectProfileRepository.findByUser(userId);
    return rows.map((r) => ({
      subject: r.subject,
      conceptsSeen: r.conceptsSeen,
      difficulties: r.difficulties,
      masteryNotes: r.masteryNotes,
      sessionsCount: r.sessionsCount,
      updatedAt: r.updatedAt,
    }));
  }

  async editMemory(userId: string, subject: string, patch: { masteryNotes?: string | null; difficulties?: string[] }) {
    return studentSubjectProfileRepository.updateNotes(userId, subject, patch);
  }

  async formatSubjectMemoryForPrompt(userId: string, subject: string): Promise<string | null> {
    if (!isRealSubject(subject)) return null;
    const profile = await studentSubjectProfileRepository.findByUserAndSubject(userId, subject);
    if (!profile) return null;
    const concepts = profile.conceptsSeen.slice(-PROMPT_CONCEPTS);
    const difficulties = profile.difficulties.slice(-PROMPT_DIFFICULTIES);
    if (concepts.length === 0 && difficulties.length === 0 && !profile.masteryNotes) return null;
    const lines = [`Matière : ${subject}`];
    if (concepts.length) lines.push(`Concepts déjà abordés : ${concepts.join(', ')}`);
    if (difficulties.length) lines.push(`Points de difficulté récurrents : ${difficulties.join(', ')}`);
    if (profile.masteryNotes) lines.push(`Note : ${profile.masteryNotes}`);
    return `<subject_memory>\n${lines.join('\n')}\n</subject_memory>`;
  }
}

export const subjectProfileService = new SubjectProfileService();
