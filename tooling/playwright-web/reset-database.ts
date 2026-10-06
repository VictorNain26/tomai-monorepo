/** Recreates the suite's own database, empty, before the server migrates it: each run starts clean. */

import postgres from 'postgres';

const url = new URL(process.argv[2] ?? '');
const name = url.pathname.slice(1);
if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`Not a database name: ${name}`);

url.pathname = '/postgres';
const admin = postgres(url.href, { max: 1, onnotice: () => undefined });
await admin.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
await admin.unsafe(`CREATE DATABASE ${name}`);
await admin.end();
