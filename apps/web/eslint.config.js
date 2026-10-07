import { config } from '@repo/eslint-config/react-internal';

/** @type {import("eslint").Linter.Config[]} */
export default [
  { ignores: ['dist/', 'src/routeTree.gen.ts'] },
  ...config,
  {
    languageOptions: {
      parserOptions: { tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      // A route's beforeLoad throws TanStack Router's redirect, a Response, as its docs do.
      '@typescript-eslint/only-throw-error': ['error', { allow: [{ from: 'package', package: '@tanstack/router-core', name: 'Redirect' }] }],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/lib/zod.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        { paths: [{ name: 'zod', message: 'Import z from src/lib/zod: it is set jitless before any schema.', allowTypeImports: true }] },
      ],
    },
  },
];
