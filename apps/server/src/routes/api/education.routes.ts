import { Hono } from 'hono';
import type { AppEnv } from '../../platform/http/context.js';
import { EDUCATION_LEVELS, levelLabel } from '../../lib/education-levels.js';

export const educationApiRoutes = new Hono<AppEnv>()

  .get('/education/levels', (c) => c.json({
    levels: EDUCATION_LEVELS.map((key) => ({ key, label: levelLabel(key) })),
  }));
