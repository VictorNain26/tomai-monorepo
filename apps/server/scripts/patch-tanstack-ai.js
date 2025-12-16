/**
 * Patch script for TanStack AI
 *
 * Fixes the import issue in @tanstack/ai where it imports toJSONSchema from
 * @alcyone-labs/zod-to-json-schema (which exports zodToJsonSchema, not toJSONSchema)
 *
 * The fix: Replace the import to use Zod 4's native toJSONSchema export
 * This matches the fix on TanStack AI's GitHub main branch (commit: feat: JSONSchema support v2 #125)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const TANSTACK_AI_PATH = join(process.cwd(), 'node_modules/@tanstack/ai/dist/esm/tools/zod-converter.js');

// Old import that doesn't work (npm v0.0.3)
const OLD_IMPORT = 'import { toJSONSchema } from "@alcyone-labs/zod-to-json-schema";';
// New import using Zod 4's native toJSONSchema (GitHub main)
const NEW_IMPORT = 'import { toJSONSchema } from "zod";';

function patchTanStackAI() {
  console.log('[patch-tanstack-ai] Checking TanStack AI installation...');

  if (!existsSync(TANSTACK_AI_PATH)) {
    console.log('[patch-tanstack-ai] TanStack AI not installed, skipping patch.');
    return;
  }

  const content = readFileSync(TANSTACK_AI_PATH, 'utf-8');

  if (content.includes(OLD_IMPORT)) {
    console.log('[patch-tanstack-ai] Found broken import, applying patch...');
    const patched = content.replace(OLD_IMPORT, NEW_IMPORT);
    writeFileSync(TANSTACK_AI_PATH, patched, 'utf-8');
    console.log('[patch-tanstack-ai] Patch applied successfully!');
    console.log('[patch-tanstack-ai] Changed: @alcyone-labs/zod-to-json-schema -> zod');
  } else if (content.includes(NEW_IMPORT)) {
    console.log('[patch-tanstack-ai] Already patched, nothing to do.');
  } else {
    console.log('[patch-tanstack-ai] Import pattern not recognized, manual check needed.');
    console.log('[patch-tanstack-ai] Content preview:', content.substring(0, 200));
  }
}

patchTanStackAI();
