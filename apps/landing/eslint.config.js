import { nextJsConfig } from '@repo/eslint-config/next-js';

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...nextJsConfig,
  {
    languageOptions: {
      parserOptions: { tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    // Next renders JSON-LD only through dangerouslySetInnerHTML; this one component escapes it.
    // https://nextjs.org/docs/app/guides/json-ld
    files: ['components/json-ld.tsx'],
    rules: { '@eslint-react/dom-no-dangerously-set-innerhtml': 'off' },
  },
];
