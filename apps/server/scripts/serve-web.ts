/**
 * The web build served as in production, by the security headers and web client of app.ts, without
 * the API, its database or its keys: the web's preview and its e2e tests run against it.
 *
 * Usage: bun scripts/serve-web.ts <dist directory> <port>
 */

import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Hono } from 'hono';
import { securityHeaders } from '../src/platform/http/security-headers';
import { webClient } from '../src/platform/http/web-client';

const [dist, port] = Bun.argv.slice(2);
if (!dist || !existsSync(join(dist, 'index.html')) || !Number.isInteger(Number(port))) {
  console.error('Usage: bun scripts/serve-web.ts <dist directory, with index.html> <port>');
  process.exit(1);
}

const app = new Hono().use(securityHeaders({ development: false })).route('/', webClient(resolve(dist)));
const server = Bun.serve({ port: Number(port), fetch: app.fetch });
console.log(`Web build on ${server.url.href}`);
