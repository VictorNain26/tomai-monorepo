/**
 * The web client (apps/web build) served on the API's own origin: the session cookie stays
 * first-party and no request needs CORS. Mounted after every API route.
 */

import { serveStatic } from '@hono/bun';
import { Hono, type Context } from 'hono';
import { except } from 'hono/combine';
import { compress } from 'hono/compress';
import { etag } from 'hono/etag';

// Vite fingerprints only what it emits under assets/ (build.assetsDir); every other file
// (index.html, sw.js, the manifest, the icons) keeps its name from one build to the next.
function setCacheControl(_path: string, c: Context) {
  c.header('Cache-Control', c.req.path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache');
}

// No client route has an extension: such a path asks for a file (robots.txt, an icon, a chunk of
// an older build), and a missing one stays a 404 rather than the page.
const asksForFile = (c: Context) => /\.[^/]*$/.test(c.req.path);

/**
 * Files of `distDir`, then `index.html` for any other GET so the client router takes the path.
 * Never under /api, where an unknown route stays the JSON 404. Compressed, with an ETag so that
 * `no-cache` revalidates in a 304; compress() weakens the ETag of the bytes it encodes.
 */
export function webClient(distDir: string) {
  return new Hono().get(
    '*',
    except(
      '/api/*',
      compress(),
      etag(),
      serveStatic({ root: distDir, onFound: setCacheControl }),
      except(asksForFile, serveStatic({ root: distDir, path: 'index.html', onFound: setCacheControl })),
    ),
  );
}
