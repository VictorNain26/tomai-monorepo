import { fixupPluginRules } from "@eslint/compat";
import { globalIgnores } from "eslint/config";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginReact from "eslint-plugin-react";
import globals from "globals";
import pluginNext from "@next/eslint-plugin-next";
import { config as baseConfig } from "./base.js";

// eslint-plugin-react@7.x not yet ESLint 10 compatible
const fixedReact = fixupPluginRules(pluginReact);
const fixedReactHooks = fixupPluginRules(pluginReactHooks);
const fixedNext = fixupPluginRules(pluginNext);

/**
 * A custom ESLint configuration for libraries that use Next.js.
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export const nextJsConfig = [
  ...baseConfig,
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    plugins: { react: fixedReact },
    rules: pluginReact.configs.flat.recommended.rules,
    languageOptions: {
      ...pluginReact.configs.flat.recommended.languageOptions,
      globals: {
        ...globals.serviceworker,
      },
    },
  },
  {
    plugins: {
      "@next/next": fixedNext,
    },
    rules: {
      ...pluginNext.configs.recommended.rules,
      ...pluginNext.configs["core-web-vitals"].rules,
    },
  },
  {
    plugins: {
      "react-hooks": fixedReactHooks,
    },
    settings: { react: { version: "detect" } },
    rules: {
      ...pluginReactHooks.configs.recommended.rules,
      // React scope no longer necessary with new JSX transform.
      "react/react-in-jsx-scope": "off",
    },
  },
  {
    files: ["*.config.{js,mjs,ts}", "*.config.{cjs,cts}"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
];
