import { Elysia, t } from 'elysia';
import { authMacro } from '../../lib/auth-macro';
import { logger } from '../../lib/observability';
import { educationService } from '../../services/education.service';
import { qdrantService } from '../../services/qdrant.service';
import { subjectLabels } from './helpers';
import type { EducationLevelType } from '../../types/index';

const LEVEL_SCHEMA = t.Optional(t.Union([
  t.Literal('cp'), t.Literal('ce1'), t.Literal('ce2'),
  t.Literal('cm1'), t.Literal('cm2'),
  t.Literal('sixieme'), t.Literal('cinquieme'),
  t.Literal('quatrieme'), t.Literal('troisieme'),
  t.Literal('seconde'), t.Literal('premiere'), t.Literal('terminale'),
]));

export const deckDiscoveryRoutes = new Elysia({ prefix: '/api/learning' })
  .use(authMacro)
  .guard({ auth: true })

  .get('/subjects', async ({ query, user, set }) => {
    const niveau = (query.niveau ?? user.schoolLevel ?? 'sixieme') as EducationLevelType;

    try {
      const subjects = await educationService.getSubjectsForLevel(niveau);

      const formattedSubjects = subjects.map(s => ({
        id: s.key,
        label: subjectLabels[s.key] || s.key,
      }));

      logger.info('Subjects fetched for level', {
        operation: 'learning:subjects:list',
        userId: user.id, niveau, count: subjects.length,
      });

      return { niveau, subjects: formattedSubjects };
    } catch (error) {
      logger.error('Failed to fetch subjects', {
        operation: 'learning:subjects:list',
        userId: user.id, niveau,
        _error: error instanceof Error ? error.message : String(error),
        severity: 'medium' as const,
      });
      set.status = 500;
      return { error: 'Failed to fetch subjects' };
    }
  }, {
    query: t.Object({ niveau: LEVEL_SCHEMA }),
  })

  .get('/topics', async ({ query, user, set }) => {
    const { matiere } = query;
    const niveau = (query.niveau ?? user.schoolLevel ?? 'sixieme') as EducationLevelType;

    if (!matiere) {
      set.status = 400;
      return { error: 'matiere is required' };
    }

    try {
      const domaines = await qdrantService.getTopics(matiere, niveau);
      const totalTopics = domaines.reduce((sum, d) => sum + d.themes.length, 0);

      logger.info('Topics fetched from Qdrant', {
        operation: 'learning:topics:list',
        userId: user.id, matiere, niveau,
        domainesCount: domaines.length, totalTopics,
      });

      return { matiere, niveau, domaines, totalTopics };
    } catch (error) {
      logger.error('Failed to fetch topics', {
        operation: 'learning:topics:list',
        userId: user.id, matiere, niveau,
        _error: error instanceof Error ? error.message : String(error),
        severity: 'medium' as const,
      });
      set.status = 500;
      return { error: 'Failed to fetch topics' };
    }
  }, {
    query: t.Object({
      matiere: t.String({ minLength: 1 }),
      niveau: LEVEL_SCHEMA,
    }),
  })

  .get('/chapters', async ({ query, user, set }) => {
    const { matiere } = query;
    const niveau = (query.niveau ?? user.schoolLevel ?? 'sixieme') as EducationLevelType;

    if (!matiere) {
      set.status = 400;
      return { error: 'matiere is required' };
    }

    try {
      const matiereLabel = subjectLabels[matiere] ?? matiere;
      const hierarchy = await qdrantService.getChaptersHierarchy(matiere, niveau, matiereLabel);

      logger.info('Chapters hierarchy fetched', {
        operation: 'learning:chapters:list',
        userId: user.id, matiere, niveau,
        totalChapters: hierarchy.totalChapters,
        totalSubChapters: hierarchy.totalSubChapters,
        totalTopics: hierarchy.totalTopics,
      });

      return hierarchy;
    } catch (error) {
      logger.error('Failed to fetch chapters', {
        operation: 'learning:chapters:list',
        userId: user.id, matiere, niveau,
        _error: error instanceof Error ? error.message : String(error),
        severity: 'medium' as const,
      });
      set.status = 500;
      return { error: 'Failed to fetch chapters' };
    }
  }, {
    query: t.Object({
      matiere: t.String({ minLength: 1 }),
      niveau: LEVEL_SCHEMA,
    }),
  });
