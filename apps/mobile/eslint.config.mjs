import baseConfig from '@repo/eslint-config/react';

export default [
  ...baseConfig,
  {
    ignores: ['.expo/**', 'node_modules/**', 'metro.config.js', 'babel.config.js', 'tailwind.config.js'],
  },
  {
    rules: {
      // Apostrophes/quotes are fine in React Native Text components
      'react/no-unescaped-entities': 'off',
    },
  },
];
