import boundaries from 'eslint-plugin-boundaries';
import { nodeConfig } from '@repo/eslint-config/node';

// The dependency rules of docs/etudes/2026-10-06/refonte-architecture.md, « Serveur »:
// what is not allowed here is refused.
const elements = [
  { type: 'platform', pattern: 'src/platform/*', partialMatch: false, capture: ['part'] },
  { type: 'domain', pattern: 'src/domain', partialMatch: false },
  { type: 'module', pattern: 'src/modules/*', partialMatch: false, capture: ['module'] },
  { type: 'referential', pattern: 'src/referential', partialMatch: false },
  { type: 'eval', pattern: 'src/eval', partialMatch: false },
  { type: 'testing', pattern: 'src/testing', partialMatch: false },
];

// Single files are classified by file descriptors, folders by elements (jsboundaries.dev, « Elements »).
const files = [
  { pattern: '**/*.test.ts', category: 'test' },
  { pattern: ['src/main.ts', 'src/migrate.ts', 'src/app.ts'], category: 'root' },
  { pattern: 'src/config.ts', category: 'config' },
  // In a module, routes → service → repository, and only the repository and the schema touch the database.
  { pattern: 'src/modules/*/index.ts', category: 'module-index' },
  { pattern: 'src/modules/*/routes.ts', category: 'routes' },
  { pattern: 'src/modules/*/service.ts', category: 'service' },
  { pattern: 'src/modules/*/repository.ts', category: 'repository' },
  { pattern: 'src/modules/*/schema.ts', category: 'schema' },
];

// A test passes its doubles in; replacing a module hides the wiring and breaks silently.
const NO_MOCK_MODULE = {
  object: 'mock',
  property: 'module',
  message: 'Pas de mock.module : passer la dépendance en paramètre (.claude/rules/testing.md).',
};

// Only the entry points read the environment: everything else receives the config.
const NO_ENVIRONMENT = ['Bun', 'process'].map((object) => ({
  object,
  property: 'env',
  message: "L'environnement ne se lit que dans src/main.ts et src/migrate.ts : recevoir la config en paramètre.",
}));

const element = (type) => ({ element: { type } });
const file = (categories) => ({ file: { categories } });
const allow = (from, ...to) => ({ from, allow: { to } });
const sameModule = (categories) => ({
  element: { type: 'module', captured: { module: '{{ from.element.captured.module }}' } },
  file: { categories },
});
const inModule = (categories) => ({ element: { type: 'module' }, file: { categories } });

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
          // Also between files of one element: the layers inside a module are checked too.
          checkInternals: true,
          policies: [
            allow(file('root'), file(['root', 'config']), element(['platform', 'domain']), inModule(['module-index'])),
            allow(inModule(['module-index']), sameModule(['routes', 'service', 'repository']), element('platform')),
            allow(inModule(['routes']), sameModule(['service']), element(['platform', 'domain'])),
            allow(inModule(['service']), sameModule(['repository']), element(['platform', 'domain'])),
            allow(inModule(['repository']), sameModule(['schema']), element(['platform', 'domain'])),
            allow(inModule(['schema']), element(['platform', 'domain'])),
            allow(element('platform'), element('platform'), file('config')),
            allow(element('domain'), element('domain')),
            allow(element('referential'), element(['referential', 'domain'])),
            allow(element('eval'), element(['eval', 'referential', 'domain'])),
            allow(element('testing'), element(['testing', 'platform'])),
            allow(file('test'), file(['root', 'config']), element(['platform', 'domain', 'module', 'referential', 'eval', 'testing'])),
          ],
        },
      ],
      // A file outside every element and descriptor would escape the rules above.
      'boundaries/no-unknown-files': 'error',
      'no-restricted-properties': ['error', NO_MOCK_MODULE],
      'no-restricted-syntax': [
        'error',
        {
          selector: "TSTypeReference[typeName.type='ImportExpression']",
          message: 'Les imports dynamiques dans les types sont interdits. Utilisez des imports statiques en haut de fichier.',
        },
      ],
    },
  },
  {
    files: ['src/**/*.ts'],
    ignores: ['src/main.ts', 'src/migrate.ts', 'src/testing/**'],
    rules: {
      'no-restricted-properties': ['error', NO_MOCK_MODULE, ...NO_ENVIRONMENT],
    },
  },
];
