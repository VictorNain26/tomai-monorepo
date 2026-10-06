/**
 * The web client (apps/web build) served on the API's own origin: the session cookie stays
 * first-party and no request needs CORS. Mounted after every API route.
 */

import { serveStatic } from '@hono/bun';
import { Hono, type Context } from 'hono';
import { except } from 'hono/combine';

// Vite fingerprints only what it emits under assets/ (build.assetsDir); every other file
// (index.html, sw.js, the manifest, the icons) keeps its name from one build to the next.
function setCacheControl(_path: string, c: Context) {
  c.header('Cache-Control', c.req.path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache');
}

/**
 * Files of `distDir`, then `index.html` for any other GET so the client router takes the path.
 * Never under /api (an unknown API route stays the JSON 404) nor for a missing hashed asset.
 */
export function webClient(distDir: string) {
  return new Hono()
    .get('*', except('/api/*', serveStatic({ root: distDir, onFound: setCacheControl })))
    .get('*', except(['/api/*', '/assets/*'], serveStatic({ root: distDir, path: 'index.html', onFound: setCacheControl })));
}
