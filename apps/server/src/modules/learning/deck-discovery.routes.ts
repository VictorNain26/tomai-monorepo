import { Hono } from 'hono';
import type { AuthEnv } from '../../platform/http/context.js';
import { SUBJECT_SLUGS, SUBJECTS } from '../../lib/subjects.js';

export const deckDiscoveryRoutes = new Hono<AuthEnv>().get('/subjects', (c) =>
  c.json({
    subjects: SUBJECT_SLUGS.map((id) => ({ id, label: SUBJECTS[id].label })),
  }),
);
