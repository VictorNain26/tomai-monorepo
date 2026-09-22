import { Elysia } from 'elysia';
import { apiHealthRoutes } from './health.routes';
import { chatSessionApiRoutes } from './chat-session.routes';
import { parentApiRoutes } from './parent.routes';
import { educationApiRoutes } from './education.routes';
import { progressApiRoutes } from './progress.routes';
import { sessionFilesApiRoutes } from './session-files.routes';
import { studentApiRoutes } from './student.routes';

export const apiRoutes = new Elysia({ name: 'api-routes' })

  // Mounted at root (not under /api): GET /health is the single canonical
  // health endpoint, polled by the Dockerfile HEALTHCHECK.
  .use(apiHealthRoutes)

  .onParse(async ({ request }, contentType) => {
    if (contentType === 'application/json') {
      return JSON.parse(await request.text());
    }
  })
  .group('/api', (app) => app
    .use(chatSessionApiRoutes)
    .use(parentApiRoutes)
    .use(educationApiRoutes)
    .use(progressApiRoutes)
    .use(sessionFilesApiRoutes)
    .use(studentApiRoutes)
  );
