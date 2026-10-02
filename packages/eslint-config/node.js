import globals from "globals";
import { config as baseConfig } from "./base.js";

/**
 * ESLint configuration for Bun services.
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export const nodeConfig = [
  ...baseConfig,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        Bun: "readonly",
      },
    },
  },
  {
    // The bun:test DSL is built on these patterns: mock factories mirror async
    // signatures without awaiting or do nothing at all, mock.module/describe
    // return thenables called for their side effects, and asymmetric matchers
    // (expect.any, expect.objectContaining) are typed any. Tests also assign
    // process.env to configure the code under test, which is not a task input.
    files: ["**/*.test.ts", "**/_helpers/**/*.ts"],
    rules: {
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/no-empty-function": ["error", { allow: ["arrowFunctions"] }],
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "turbo/no-undeclared-env-vars": "off",
    },
  },
];
