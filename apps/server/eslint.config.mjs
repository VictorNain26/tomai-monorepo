import { nodeConfig } from '@repo/eslint-config/node';

/** @type {import("eslint").Linter.Config[]} */
export default [
  {
    ignores: ['dist/**', 'coverage/**', 'build/**'],
  },
  ...nodeConfig,
  {
    languageOptions: {
      parserOptions: { tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "TSTypeReference[typeName.type='ImportExpression']",
          message: 'Les imports dynamiques dans les types sont interdits. Utilisez des imports statiques en haut de fichier.',
        },
        {
          selector: "ImportExpression[source.value*='types/']",
          message: "Les imports dynamiques de types sont interdits. Utilisez 'import type' en haut de fichier.",
        },
      ],
    },
  },
];
