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
];
