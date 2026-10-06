/**
 * Security headers of every response, the web client's pages included.
 */

import { except } from 'hono/combine';
import { secureHeaders } from 'hono/secure-headers';

/**
 * The CSP allows nothing but this origin: the Vite build of apps/web carries no inline script or
 * style and no data: asset (build.assetsInlineLimit: 0), and registers its service worker from a
 * file. In development, no HSTS, so http://localhost keeps working, and none of these headers on
 * better-auth's API reference, a development-only page that loads Scalar from jsdelivr with an
 * inline script.
 */
export function securityHeaders({ development }: { development: boolean }) {
  const headers = secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
    },
    xFrameOptions: 'DENY',
    referrerPolicy: 'strict-origin-when-cross-origin',
    permissionsPolicy: { geolocation: [], microphone: [], camera: [] },
    strictTransportSecurity: development ? false : 'max-age=31536000; includeSubDomains',
  });
  return development ? except('/api/auth/reference', headers) : headers;
}
