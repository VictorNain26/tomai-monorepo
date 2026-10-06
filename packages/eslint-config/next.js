import { globalIgnores } from "eslint/config";
import globals from "globals";
import pluginNext from "@next/eslint-plugin-next";
import { config as reactConfig } from "./react-internal.js";

/**
 * A custom ESLint configuration for libraries that use Next.js.
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export const nextJsConfig = [
  ...reactConfig,
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    plugins: {
      "@next/next": pluginNext,
    },
    rules: {
      ...pluginNext.configs.recommended.rules,
      ...pluginNext.configs["core-web-vitals"].rules,
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
