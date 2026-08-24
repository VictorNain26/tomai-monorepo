import { Elysia, t } from 'elysia';
import { authMacro } from '../../lib/auth-macro.js';
import { EDUCATION_LEVEL_UNION } from '../../lib/education-levels.js';
import { logger } from '../../lib/observability';
import { educationService } from '../../services/education.service';
import { subjectLabels } from './helpers';
import type { EducationLevelType } from '../../types/index';

export const deckDiscoveryRoutes = new Elysia({ prefix: '/api/learning' })
  .use(authMacro)
  .guard({ auth: true })

  .get('/subjects', ({ query, user }) => {
    const niveau = (query.niveau ?? user.schoolLevel ?? 'sixieme') as EducationLevelType;
    const subjects = educationService.getSubjectsForLevel(niveau).map(key => ({
      id: key,
      label: subjectLabels[key] ?? key,
    }));

    logger.info('Subjects fetched for level', {
      operation: 'learning:subjects:list',
      userId: user.id, niveau, count: subjects.length,
    });

    return { niveau, subjects };
  }, {
    query: t.Object({ niveau: t.Optional(EDUCATION_LEVEL_UNION) }),
  });
