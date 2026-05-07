import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginReact from "eslint-plugin-react";
import globals from "globals";
import { config as baseConfig } from "./base.js";

/**
 * ESLint configuration for React Native applications.
 *
 * @type {import("eslint").Linter.Config[]} */
export default [
  ...baseConfig,
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,
  {
    languageOptions: {
      ...pluginReact.configs.flat.recommended.languageOptions,
      globals: {
        ...globals.node,
      },
    },
  },
  {
    plugins: {
      "react-hooks": pluginReactHooks,
    },
    // Explicit react version: ESLint 10 removed `context.getFilename()`, which
    // eslint-plugin-react@7.37.5 still calls inside its `version: "detect"` codepath.
    // Pinning a concrete version skips the detection helper entirely.
    settings: { react: { version: "19.2.0" } },
    rules: {
      ...pluginReactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
    },
  },
];
