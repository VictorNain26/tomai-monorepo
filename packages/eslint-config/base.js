import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import turboPlugin from "eslint-plugin-turbo";
import tseslint from "typescript-eslint";

/**
 * A shared ESLint configuration for the repository: type-checked strict and
 * stylistic presets, no inline config, unused disable directives as errors.
 *
 * Each consumer sets `parserOptions.tsconfigRootDir` to its own directory.
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export const config = [
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  eslintConfigPrettier,
  {
    languageOptions: {
      parserOptions: { projectService: true },
    },
    linterOptions: {
      noInlineConfig: true,
      reportUnusedDisableDirectives: "error",
    },
    plugins: {
      turbo: turboPlugin,
    },
    rules: {
      "turbo/no-undeclared-env-vars": "error",
      // A number renders the same way everywhere; the rule stays on to catch
      // objects, arrays and nullish values interpolated by mistake.
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      // A leading underscore marks a parameter kept for its position or type.
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    ignores: ["dist/**"],
  },
];
