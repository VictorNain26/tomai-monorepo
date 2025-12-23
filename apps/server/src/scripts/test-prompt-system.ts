#!/usr/bin/env bun
/**
 * Script de test du système de prompts LearnLM v3
 * Mode 1: Validation structurelle (sans API)
 * Mode 2: Test live avec Gemini (avec GEMINI_API_KEY)
 *
 * Usage:
 *   bun run src/scripts/test-prompt-system.ts          # Mode structurel
 *   bun run src/scripts/test-prompt-system.ts --live   # Mode live avec API
 */

import { config } from 'dotenv';
config({ path: '.env', quiet: true });

import { buildSystemPrompt } from '../config/prompts/index.js';
import type { EducationLevelType } from '../types/index.js';

// Mapping niveau -> texte
const LEVEL_TEXT: Record<EducationLevelType, string> = {
  cp: 'CP (6 ans)', ce1: 'CE1 (7 ans)', ce2: 'CE2 (8 ans)',
  cm1: 'CM1 (9 ans)', cm2: 'CM2 (10 ans)',
  sixieme: '6ème (11 ans)', cinquieme: '5ème (12 ans)',
  quatrieme: '4ème (13 ans)', troisieme: '3ème (14 ans)',
  seconde: '2nde (15 ans)', premiere: '1ère (16 ans)', terminale: 'Terminale (17 ans)'
};

const getLevelText = (level: EducationLevelType): string => LEVEL_TEXT[level] ?? level;

// Test cases
const testCases: Array<{
  level: EducationLevelType;
  subject: string;
  query: string;
  description: string;
}> = [
  { level: 'cm1', subject: 'Mathématiques', query: 'Comment faire une division ?', description: 'CM1 Maths (cycle 3)' },
  { level: 'troisieme', subject: 'Français', query: 'Comment analyser un texte ?', description: '3ème Français (cycle 4)' },
  { level: 'terminale', subject: 'Physique-Chimie', query: 'Explique la mécanique quantique', description: 'Terminale Physique (lycée)' },
  { level: 'cp', subject: 'Français', query: 'Comment lire ce mot ?', description: 'CP Français (cycle 2)' },
];

async function testStructural() {
  console.log('🧪 Test STRUCTUREL du système de prompts LearnLM v3\n');
  console.log('='.repeat(70));

  let totalTokens = 0;
  let validPrompts = 0;

  for (const testCase of testCases) {
    console.log(`\n📚 ${testCase.description}`);

    try {
      const levelText = getLevelText(testCase.level);
      const systemPrompt = buildSystemPrompt({
        level: testCase.level,
        levelText,
        subject: testCase.subject,
        firstName: 'Élève Test'
      });

      // Estimation tokens (1 token ≈ 4 chars FR)
      const estimatedTokens = Math.ceil(systemPrompt.length / 4);
      totalTokens += estimatedTokens;

      // Validation structure
      const hasRole = systemPrompt.includes('<role>');
      const hasPedagogy = systemPrompt.includes('<pedagogy>');
      const hasSafety = systemPrompt.includes('<safety>');
      const hasLevel = systemPrompt.includes('<level_adaptation');
      const hasContext = systemPrompt.includes('<context');

      const isValid = hasRole && hasPedagogy && hasSafety && hasLevel && hasContext;
      if (isValid) validPrompts++;

      console.log(`   Tokens: ~${estimatedTokens} | Structure: ${isValid ? '✅' : '❌'}`);
      console.log(`   Blocs: role=${hasRole ? '✓' : '✗'} pedagogy=${hasPedagogy ? '✓' : '✗'} safety=${hasSafety ? '✓' : '✗'} level=${hasLevel ? '✓' : '✗'} context=${hasContext ? '✓' : '✗'}`);

      // Afficher un extrait
      console.log('\n   📄 Extrait prompt:');
      const preview = systemPrompt.slice(0, 300).split('\n').map(l => '      ' + l).join('\n');
      console.log(preview + '\n      [...]');

    } catch (error) {
      console.log(`   ❌ Erreur: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`📊 RÉSULTATS: ${validPrompts}/${testCases.length} prompts valides`);
  console.log(`📊 Moyenne tokens: ~${Math.round(totalTokens / testCases.length)} tokens/prompt`);
  console.log(`📊 Réduction vs ancien système: ~44% (estimé 1800 → 1000 tokens)\n`);
}

async function testLive() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY non définie. Ajoute-la dans apps/server/.env');
    process.exit(1);
  }

  const { chat } = await import('@tanstack/ai');
  const { createGeminiChat } = await import('@tanstack/ai-gemini');
  const geminiAdapter = createGeminiChat('gemini-2.5-flash', apiKey, {});

  console.log('🧪 Test LIVE avec Gemini 2.5 Flash\n');
  console.log('='.repeat(70));

  for (const testCase of testCases.slice(0, 2)) { // 2 tests seulement pour économiser les tokens
    console.log(`\n📚 ${testCase.description}`);
    console.log(`   Question: "${testCase.query}"`);

    try {
      const levelText = getLevelText(testCase.level);
      const systemPrompt = buildSystemPrompt({
        level: testCase.level,
        levelText,
        subject: testCase.subject,
        firstName: 'Élève Test'
      });

      const startTime = Date.now();
      const response = await chat({
        adapter: geminiAdapter,
        messages: [{ role: 'user', content: testCase.query }],
        system: systemPrompt,
        maxTokens: 300,
      });
      const duration = Date.now() - startTime;

      console.log(`\n   ✅ Réponse (${duration}ms):`);
      const preview = response.content.slice(0, 250).split('\n').map(l => '      ' + l).join('\n');
      console.log(preview);
      if (response.content.length > 250) console.log('      [...]');

    } catch (error) {
      console.log(`   ❌ Erreur API: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ Tests live terminés\n');
}

// Mode d'exécution
const isLive = process.argv.includes('--live');
if (isLive) {
  testLive().catch(console.error);
} else {
  testStructural().catch(console.error);
}
