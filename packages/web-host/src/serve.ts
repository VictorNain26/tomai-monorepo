#!/usr/bin/env bun
/**
 * The web build served as in production, by the same security headers and web client as the
 * server, without the API, its database or its keys: the web's preview and its e2e run on it.
 *
 * Usage: serve-web <dist directory> <port>
 */

import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Hono } from 'hono';
import { securityHeaders } from './security-headers';
import { webClient } from './web-client';

const [dist, port] = Bun.argv.slice(2);
if (!dist || !existsSync(join(dist, 'index.html')) || !Number.isInteger(Number(port))) {
  console.error('Usage: serve-web <dist directory, with index.html> <port>');
  process.exit(1);
}

const app = new Hono().use(securityHeaders({ hsts: false })).route('/', webClient(resolve(dist)));
const server = Bun.serve({ port: Number(port), fetch: app.fetch });
console.log(`Web build on ${server.url.href}`);
