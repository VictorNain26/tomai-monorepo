import { Elysia } from 'elysia';
import { healthApiRoutes, apiHealthRoutes } from './health.routes';
import { chatSessionApiRoutes } from './chat-session.routes';
import { parentApiRoutes } from './parent.routes';
import { educationApiRoutes } from './education.routes';
import { progressApiRoutes } from './progress.routes';
import { pushTokenApiRoutes } from './push-token.routes';
import { sessionFilesApiRoutes } from './session-files.routes';
import { studentApiRoutes } from './student.routes';

export const apiRoutes = new Elysia({ name: 'api-routes' })

  .use(healthApiRoutes)

  .onParse(async ({ request }, contentType) => {
    if (contentType === 'application/json') {
      return JSON.parse(await request.text());
    }
  })
  .group('/api', (app) => app
    .use(apiHealthRoutes)
    .use(chatSessionApiRoutes)
    .use(parentApiRoutes)
    .use(educationApiRoutes)
    .use(progressApiRoutes)
    .use(pushTokenApiRoutes)
    .use(sessionFilesApiRoutes)
    .use(studentApiRoutes)
  );
