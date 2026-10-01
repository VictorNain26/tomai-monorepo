import { Hono } from 'hono';
import { z } from 'zod';
import { educationLevelSchema } from '../../lib/education-levels.js';
import { validate, type AuthEnv } from '../../lib/http.js';
import { logger } from '../../lib/observability';
import { educationService } from '../../services/education.service';
import { subjectLabels } from './helpers';
import type { EducationLevelType } from '../../types/index';

const subjectsQuery = z.object({ niveau: educationLevelSchema.optional() });

export const deckDiscoveryRoutes = new Hono<AuthEnv>()

  .get('/subjects', validate('query', subjectsQuery), (c) => {
    const user = c.var.user;
    const query = c.req.valid('query');
    const niveau = (query.niveau ?? user.schoolLevel ?? 'sixieme') as EducationLevelType;
    const subjects = educationService.getSubjectsForLevel(niveau).map(key => ({
      id: key,
      label: subjectLabels[key] ?? key,
    }));

    logger.info('Subjects fetched for level', {
      operation: 'learning:subjects:list',
      userId: user.id, niveau, count: subjects.length,
    });

    return c.json({ niveau, subjects });
  });
