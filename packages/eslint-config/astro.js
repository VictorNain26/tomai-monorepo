import eslintPluginAstro from 'eslint-plugin-astro';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { config as baseConfig } from './base.js';

/**
 * ESLint configuration for an Astro site, its components' scripts running in the browser.
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export const astroConfig = [
  ...baseConfig,
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
    languageOptions: {
      globals: {
        ...globals.browser,
      },
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
