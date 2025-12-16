#!/usr/bin/env bun
/**
 * Generate Eden Types - TomAI Server
 *
 * This script generates a standalone TypeScript declaration file
 * containing the App type for the frontend Eden client.
 *
 * Usage:
 *   bun run scripts/generate-eden-types.ts
 *
 * Output:
 *   dist/eden-types.d.ts - Import this in the frontend
 *
 * The generated types can be copied to the frontend monorepo
 * or published as a separate package.
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = join(import.meta.dir, '../dist');
const OUTPUT_FILE = join(OUTPUT_DIR, 'eden-types.d.ts');

const EDEN_TYPES_CONTENT = `/**
 * TomAI Server - Eden Types
 *
 * Auto-generated type declarations for Eden Treaty client.
 * DO NOT EDIT MANUALLY - regenerate with: bun run scripts/generate-eden-types.ts
 *
 * Generated: ${new Date().toISOString()}
 */

// Re-export the App type from the main app module
// This provides full type inference for Eden Treaty client
export type { App } from '../src/app';
`;

async function main() {
  console.log('🔧 Generating Eden types...');

  // Ensure dist directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log('📁 Created dist directory');
  }

  // Write the declaration file
  writeFileSync(OUTPUT_FILE, EDEN_TYPES_CONTENT);
  console.log(`✅ Generated: ${OUTPUT_FILE}`);

  console.log(`
📋 Next steps:

1. Build the server to generate JavaScript:
   bun run build

2. Copy the types to frontend:
   cp dist/eden-types.d.ts ../tomai-monorepo/apps/app/src/types/

3. Update frontend eden-client.ts to import the type:
   import type { App } from '@/types/eden-types';
   export const api = treaty<App>(getBackendURL(), { ... });

Note: For automatic type sync, consider:
- Publishing @tomai/server-types package
- Setting up a pre-build script in the monorepo
`);
}

main().catch(console.error);
