import js from "@eslint/js";
import { fixupPluginRules } from "@eslint/compat";
import eslintConfigPrettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginReact from "eslint-plugin-react";
import globals from "globals";
import { config as baseConfig } from "./base.js";

// eslint-plugin-react@7.x uses ESLint v9 internal APIs (context.getFilename
// removed in v10). @eslint/compat fixupPluginRules wraps the plugin so its
// rules call the v10 equivalents. Track upstream ESLint 10 support:
// https://github.com/jsx-eslint/eslint-plugin-react/issues/3977
const fixedReact = fixupPluginRules(pluginReact);
const fixedReactHooks = fixupPluginRules(pluginReactHooks);

/**
 * ESLint configuration for React Native applications.
 *
 * @type {import("eslint").Linter.Config[]} */
export default [
  ...baseConfig,
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
  {
    plugins: { react: fixedReact },
    rules: pluginReact.configs.flat.recommended.rules,
    languageOptions: {
      ...pluginReact.configs.flat.recommended.languageOptions,
      globals: {
        ...globals.node,
      },
    },
  },
  {
    plugins: {
      "react-hooks": fixedReactHooks,
    },
    settings: { react: { version: "detect" } },
    rules: {
      ...pluginReactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
    },
  },
];
