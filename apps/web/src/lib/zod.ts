/**
 * Zod probes `new Function` when an object schema is declared, which the server's CSP (no
 * 'unsafe-eval') reports as a violation. Imported first by main.tsx: before any schema of a route.
 */

import { z } from 'zod';

z.config({ jitless: true });
