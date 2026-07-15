import baseConfig from '@repo/eslint-config/react';
import eslintPluginBetterTailwindcss from 'eslint-plugin-better-tailwindcss';

export default [
  ...baseConfig,
  {
    ignores: ['.expo/**', 'node_modules/**', 'metro.config.js', 'babel.config.js'],
  },
  {
    rules: {
      // Apostrophes/quotes are fine in React Native Text components
      'react/no-unescaped-entities': 'off',
    },
  },
  // Anti-regression gate: ban raw palette classes — use semantic tokens from @repo/tokens.
  // Known bypass: the plugin only scans className/cva/cn usage, so the decorative palette
  // strings in src/constants/subjects.ts (data object literals) are not linted — intentional.
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    plugins: { 'better-tailwindcss': eslintPluginBetterTailwindcss },
    settings: {
      'better-tailwindcss': { entryPoint: 'src/global.css' },
    },
    rules: {
      'better-tailwindcss/no-restricted-classes': [
        'error',
        {
          restrict: [
            {
              pattern:
                '^(?:[a-zA-Z0-9_/-]+:)*(?:bg|text|border|divide|ring|fill|stroke|placeholder)-(?:stone|gray|slate|zinc|neutral|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]+(?:/[0-9]+)?$',
              message:
                'Classe palette brute interdite — utiliser les classes sémantiques @repo/tokens (bg-background, text-muted-foreground, text-destructive…).',
            },
          ],
        },
      ],
    },
  },
  // Node script (Playwright web smoke) — Node globals + `document` utilisé
  // dans les callbacks page.evaluate (exécutés dans le navigateur)
  {
    files: ['scripts/web-smoke.mjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        document: 'readonly',
      },
    },
  },
  // Test files configuration
  {
    files: ['**/__tests__/**/*', '**/*.test.ts', '**/*.test.tsx', 'jest.setup.js', '__mocks__/**/*'],
    languageOptions: {
      globals: {
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'react/display-name': 'off',
    },
  },
];
