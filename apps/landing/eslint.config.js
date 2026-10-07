import { astroConfig } from '@repo/eslint-config/astro';

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...astroConfig,
  {
    languageOptions: {
      parserOptions: { tsconfigRootDir: import.meta.dirname },
    },
  },
];
