import eslintPluginAstro from 'eslint-plugin-astro';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { config as reactConfig } from './react-internal.js';

/**
 * ESLint configuration for an Astro site with React islands.
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export const astroConfig = [
  ...reactConfig,
  ...eslintPluginAstro.configs.recommended,
  { ignores: ['dist/**', '.astro/**'] },
  // The TypeScript service cannot read an Astro component, so typed rules stop there; `astro check`
  // type-checks it instead.
  {
    files: ['**/*.astro', '**/*.astro/*.ts'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      parserOptions: { ...tseslint.configs.disableTypeChecked.languageOptions.parserOptions, parser: tseslint.parser },
    },
  },
  {
    files: ['*.config.{js,mjs,ts}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
];
