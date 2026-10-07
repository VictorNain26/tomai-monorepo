/**
 * Zod probes `new Function` when an object schema is declared, which the server's CSP (no
 * 'unsafe-eval') reports as a violation. Every module takes `z` from here, so that the bundle
 * evaluates this configuration before any schema, whichever chunk holds it.
 */

import { z } from 'zod';

z.config({ jitless: true });

export { z };
