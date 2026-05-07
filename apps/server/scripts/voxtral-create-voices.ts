/**
 * One-shot helper: create the 3 master Voxtral voices used by Tom (primaire,
 * collège, lycée) and print their `voice_id` so they can be wired into env.
 *
 * Voxtral TTS does not ship pre-defined voices — every voice is cloned from a
 * 2-3s reference audio sample. Run this script once with three local audio
 * samples on disk; the printed ids go into `VOXTRAL_VOICE_PRIMAIRE`,
 * `VOXTRAL_VOICE_COLLEGE` and `VOXTRAL_VOICE_LYCEE` (env / Koyeb secrets).
 *
 * Usage:
 *   bun run scripts/voxtral-create-voices.ts \
 *     --primaire ./samples/primaire.mp3 \
 *     --college  ./samples/college.mp3 \
 *     --lycee    ./samples/lycee.mp3
 */

import { Mistral } from '@mistralai/mistralai';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

interface VoiceSpec {
  envKey: 'VOXTRAL_VOICE_PRIMAIRE' | 'VOXTRAL_VOICE_COLLEGE' | 'VOXTRAL_VOICE_LYCEE';
  name: string;
  gender: 'female' | 'male';
}

const SPECS: Array<VoiceSpec & { flag: string }> = [
  { flag: '--primaire', envKey: 'VOXTRAL_VOICE_PRIMAIRE', name: 'tom-primaire', gender: 'female' },
  { flag: '--college', envKey: 'VOXTRAL_VOICE_COLLEGE', name: 'tom-college', gender: 'female' },
  { flag: '--lycee', envKey: 'VOXTRAL_VOICE_LYCEE', name: 'tom-lycee', gender: 'male' },
];

function parseFlag(argv: readonly string[], flag: string): string | undefined {
  const idx = argv.indexOf(flag);
  if (idx === -1) return undefined;
  return argv[idx + 1];
}

async function main(): Promise<void> {
  const apiKey = process.env['MISTRAL_API_KEY'];
  if (!apiKey) {
    throw new Error('MISTRAL_API_KEY is required');
  }

  const argv = process.argv.slice(2);
  const targets: Array<VoiceSpec & { samplePath: string }> = [];
  for (const spec of SPECS) {
    const samplePath = parseFlag(argv, spec.flag);
    if (!samplePath) {
      console.error(`Missing ${spec.flag} <path-to-audio>`);
      process.exit(1);
    }
    targets.push({ ...spec, samplePath });
  }

  const client = new Mistral({ apiKey });

  for (const t of targets) {
    const absPath = path.resolve(t.samplePath);
    const buffer = await readFile(absPath);
    const sample_audio = buffer.toString('base64');
    const filename = path.basename(absPath);

    process.stdout.write(`\n→ ${t.name} (${filename})... `);

    type VoiceClient = {
      audio: { voices: { create: (req: Record<string, unknown>) => Promise<{ id: string; name: string }> } };
    };
    const voice = await (client as unknown as VoiceClient).audio.voices.create({
      name: t.name,
      sample_audio,
      sample_filename: filename,
      languages: ['fr', 'en'],
      gender: t.gender,
    });

    process.stdout.write(`✅\n`);
    console.log(`  ${t.envKey}=${voice.id}`);
  }

  console.log('\nCopy the env lines above into your deployment secrets.\n');
}

main().catch((err) => {
  console.error('\n❌ Voxtral voice creation failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
