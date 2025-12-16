/**
 * ================================================
 * CONFIGURATION ESLINT SERVER - TOMAI 2025
 * ================================================
 */

import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import globals from 'globals';


/**
 * Configuration finale SERVER - Simple et fonctionnelle
 */
export default [
  // Ignores globaux
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '*.config.js',
      '*.config.ts',
      'coverage/**',
      'build/**',
      'build.ts',
      'tests/**/*',
      'migrations/**/*.sql',
      '**/*.spec.ts',
      '**/*.test.ts',
      'patches/**/*',
      'shared-types/**',
      'src/scripts/**/*',           // Scripts de maintenance (non-runtime)
      'src/tests/integration/**/*'  // Tests d'intégration (non-runtime)
    ]
  },
  
  // Configuration principale
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: typescriptParser,
      globals: {
        ...globals.node,
        ...globals.es2024,
        Bun: 'readonly',
        Buffer: 'readonly'
      },
      parserOptions: {
        ecmaVersion: 2024,
        sourceType: 'module',
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
    },
    rules: {
      // Base rules
      ...js.configs.recommended.rules,
      
      // TypeScript rules - Production strict (selon audit recommendations)
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': 'error', // ✅ Activé selon audit
      'no-unused-vars': 'off',
      '@typescript-eslint/no-floating-promises': 'error', // ✅ Ajouté selon audit
      '@typescript-eslint/await-thenable': 'error', // ✅ Ajouté selon audit
      '@typescript-eslint/prefer-nullish-coalescing': 'warn', // ✅ Ajouté selon audit
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      
      // Node.js specific - relaxed
      'no-console': 'off',  // Allow console for server logging
      
      // Security - keep essential ones
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      
      // Code quality - warnings only
      'prefer-const': 'warn',
      'no-var': 'warn',
      
      // Interdiction des imports dynamiques dans les types
      'no-restricted-syntax': [
        'error',
        {
          selector: "TSTypeReference[typeName.type='ImportExpression']",
          message: "Les imports dynamiques dans les types sont interdits. Utilisez des imports statiques en haut de fichier."
        },
        {
          selector: "ImportExpression[source.value*='types/']",
          message: "Les imports dynamiques de types sont interdits. Utilisez 'import type' en haut de fichier."
        }
      ],
    },
  }
];