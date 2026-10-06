import boundaries from 'eslint-plugin-boundaries';
import { nodeConfig } from '@repo/eslint-config/node';

// The dependency rules of docs/etudes/2026-10-06/refonte-architecture.md, « Serveur »:
// what is not allowed here is refused.
const elements = [
  { type: 'platform', pattern: 'src/platform/*', partialMatch: false, capture: ['part'] },
  { type: 'domain', pattern: 'src/domain', partialMatch: false },
  { type: 'referential', pattern: 'src/referential', partialMatch: false },
  { type: 'eval', pattern: 'src/eval', partialMatch: false },
  { type: 'testing', pattern: 'src/testing', partialMatch: false },
];

// Single files are classified by file descriptors, folders by elements (jsboundaries.dev, « Elements »).
const files = [
  { pattern: '**/*.test.ts', category: 'test' },
  { pattern: ['src/main.ts', 'src/migrate.ts', 'src/app.ts'], category: 'root' },
  { pattern: 'src/config.ts', category: 'config' },
];

const element = (type) => ({ element: { type } });
const file = (categories) => ({ file: { categories } });
const allow = (from, ...to) => ({ from, allow: { to } });

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
  },
  {
    files: ['src/**/*.ts'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': elements,
      'boundaries/files': files,
      'import/resolver': { node: { extensions: ['.ts'] } },
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            allow(file('root'), file(['root', 'config']), element(['platform', 'domain'])),
            allow(element('platform'), element('platform'), file('config')),
            allow(element('domain'), element('domain')),
            allow(element('referential'), element(['referential', 'domain'])),
            allow(element('eval'), element(['eval', 'referential', 'domain'])),
            allow(element('testing'), element(['testing', 'platform'])),
            allow(file('test'), file(['root', 'config']), element(['platform', 'domain', 'referential', 'eval', 'testing'])),
          ],
        },
      ],
      // A file outside every element and descriptor would escape the rules above.
      'boundaries/no-unknown-files': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: "TSTypeReference[typeName.type='ImportExpression']",
          message: 'Les imports dynamiques dans les types sont interdits. Utilisez des imports statiques en haut de fichier.',
        },
      ],
    },
  },
];
