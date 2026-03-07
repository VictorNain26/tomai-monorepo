import baseConfig from '@repo/eslint-config/react';

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
