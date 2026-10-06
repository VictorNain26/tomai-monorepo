import eslintReact from '@eslint-react/eslint-plugin';
import pluginReactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import { config as baseConfig } from './base.js';

const reactStrict = eslintReact.configs['strict-type-checked'];

/**
 * ESLint configuration for React code: ESLint React's strict type-checked preset and the React
 * team's hooks rules. ESLint React's own conflict preset, applied last, turns off the hooks rules
 * it already covers, so a defect is reported once.
 *
 * @type {import("eslint").Linter.Config[]} */
export const config = [
  ...baseConfig,
  { ...reactStrict, files: ['**/*.{ts,tsx}'] },
  pluginReactHooks.configs.flat.recommended,
  eslintReact.configs['disable-conflict-eslint-plugin-react-hooks'],
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
];
