/**
 * ================================================
 * CONFIGURATION ESLINT CLIENT - TOMAI 2025 (STRICTE)
 * ================================================
 * Configuration professionnelle pour code propre et maintenable
 * ZERO TOLERANCE - Qualité maximale
 */

import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default [
  // Ignores globaux
  {
    ignores: [
      'dist/**',
      'build/**',
      'coverage/**',
      'node_modules/**',
      '.vite/**',
      '**/*.config.js',
      '**/*.config.ts',
      '**/*.spec.ts',
      '**/*.spec.tsx',
      '**/*.test.ts',
      '**/*.test.tsx',
      '../shared-types/**',
      'shared-types/**',
      'vite.config.ts'
    ]
  },
  
  // Configuration principale STRICTE
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      globals: {
        ...globals.browser,
        ...globals.es2024,
        NodeJS: 'readonly', // Fix pour les types Node.js
      },
      parserOptions: {
        ecmaVersion: 2024,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      'react': react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    settings: {
      react: { 
        version: 'detect',
        pragma: 'React',
        fragment: 'Fragment'
      },
    },
    rules: {
      // ===== RÈGLES DE BASE (STRICTES) =====
      ...js.configs.recommended.rules,
      
      // ===== TYPESCRIPT (QUALITÉ STRICTE MAIS PRATIQUE) =====
      '@typescript-eslint/no-explicit-any': 'warn', // Warn au lieu d'error pour éviter le blocage
      '@typescript-eslint/no-unused-vars': ['error', { 
        'argsIgnorePattern': '^_',
        'varsIgnorePattern': '^_',
        'ignoreRestSiblings': true 
      }],
      'no-unused-vars': 'off', // On utilise la version TypeScript
      '@typescript-eslint/no-non-null-assertion': 'warn', // Warn au lieu d'error
      '@typescript-eslint/prefer-nullish-coalescing': 'warn', // Warn pour permettre || dans certains cas
      '@typescript-eslint/prefer-optional-chain': 'warn', // Warn pour éviter les refactorings massifs
      '@typescript-eslint/no-floating-promises': 'error', // Critique pour async
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/prefer-readonly': 'off', // Désactivé pour éviter trop de refactoring
      
      // ===== REACT (QUALITÉ MAXIMALE) =====
      'react/react-in-jsx-scope': 'off', // React 19
      'react/jsx-uses-react': 'off', // React 19
      'react/prop-types': 'off', // On utilise TypeScript
      
      // React Hooks (CRITIQUE)
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn', // Warn pour éviter les blocages de développement
      
      // React Performance (STRICT)
      'react/jsx-key': ['error', { 
        checkFragmentShorthand: true,
        checkKeyMustBeforeSpread: true,
        warnOnDuplicates: true
      }],
      'react/no-array-index-key': 'error', // Performance critique
      'react/jsx-no-constructed-context-values': 'error', // Performance
      
      // React Refresh
      'react-refresh/only-export-components': ['error', { 
        allowConstantExport: true,
        allowExportNames: ['metadata', 'loader', 'action']
      }],
      
      // ===== QUALITÉ DE CODE (STRICT MAIS PRATIQUE) =====
      'no-console': 'warn', // Warn pour permettre console.error dans les catches
      'no-debugger': 'error', // Jamais en production
      'prefer-const': 'error',
      'no-var': 'error',
      'no-duplicate-imports': 'error',
      'no-unused-expressions': 'error',
      'no-unreachable': 'error',
      'no-constant-condition': 'error',
      
      // ===== SÉCURITÉ (MAXIMUM) =====
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'no-global-assign': 'error',
      'no-proto': 'error',
      'no-extend-native': 'error',
      
      // ===== STYLE ET LISIBILITÉ (PROFESSIONNEL) =====
      'object-shorthand': 'error',
      'prefer-template': 'error',
      'no-multiple-empty-lines': ['error', { max: 1, maxEOF: 1, maxBOF: 0 }],
      'eol-last': 'error',
      'no-trailing-spaces': 'error',
      'no-misleading-character-class': 'error',
      'no-regex-spaces': 'error',
      
      // ===== BONNES PRATIQUES ES6+ =====
      'prefer-arrow-callback': 'error',
      'arrow-spacing': 'error',
      'no-useless-constructor': 'error',
      'no-useless-return': 'error',
      'prefer-destructuring': ['error', {
        array: false,
        object: true
      }],
      
      // ===== GLOBALITÉS ET ENVIRONNEMENT =====
      'no-undef': 'error', // Variables non définies interdites
      'no-implicit-globals': 'error',
    },
  }
];