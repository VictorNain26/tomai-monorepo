/**
 * Security headers of every response, the web client's pages included.
 */

import { secureHeaders } from 'hono/secure-headers';

/**
 * The CSP allows nothing but this origin: the Vite build of apps/web carries no inline script or
 * style and no data: asset (build.assetsInlineLimit: 0), and registers its service worker from a
 * file. HSTS only in production, so http://localhost keeps working.
 */
export function securityHeaders({ hsts }: { hsts: boolean }) {
  return secureHeaders({
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
    strictTransportSecurity: hsts ? 'max-age=31536000; includeSubDomains' : false,
  });
}
