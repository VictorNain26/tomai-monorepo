/**
 * The web client (apps/web build) served on the API's own origin: the session cookie stays
 * first-party and no request needs CORS. Mounted after every API route.
 */

import { join } from 'node:path';
import { serveStatic } from '@hono/bun';
import { Hono, type Context } from 'hono';
import { except } from 'hono/combine';
import { etag } from 'hono/etag';

const IMMUTABLE = 'public, max-age=31536000, immutable';

// Only a navigation gets the page: a missing file (robots.txt, an icon, a chunk of an older build)
// stays a 404, whatever its path looks like.
const isNavigation = (c: Context) => c.req.header('Accept')?.includes('text/html') ?? false;

/**
 * Files of `distDir`, then `index.html` for any other navigation so the client router takes the
 * path. Never under /api, where an unknown route stays the JSON 404.
 *
 * Vite fingerprints only what it emits under assets/ (build.assetsDir): those files are cached for
 * good; every other one (index.html, sw.js, the manifest, the icons) keeps its name from one build
 * to the next, so `no-cache` revalidates it against its ETag. The build ships a .gz beside each
 * compressible file (apps/web build script), served to a browser that accepts it.
 */
export function webClient(distDir: string) {
  const assets = join(distDir, 'assets', '/');
  const setCacheControl = (path: string, c: Context) => {
    c.header('Cache-Control', path.startsWith(assets) ? IMMUTABLE : 'no-cache');
  };
  const files = { root: distDir, precompressed: true, onFound: setCacheControl };

  return new Hono().get(
    '*',
    except(
      '/api/*',
      except('/assets/*', etag()),
      serveStatic(files),
      except((c) => !isNavigation(c), serveStatic({ ...files, path: 'index.html' })),
    ),
  );
}
