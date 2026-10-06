import eslintReact from "@eslint-react/eslint-plugin";
import pluginReactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import { config as baseConfig } from "./base.js";

const reactStrict = eslintReact.configs["strict-type-checked"];

// eslint-plugin-react-hooks, the React team's, owns the hook and compiler rules. ESLint React
// copies some of them: its conflict preset lists them on the hooks side, they stay off here.
const hookRulesOwnedByReactHooks = Object.fromEntries(
  Object.keys(eslintReact.configs["disable-conflict-eslint-plugin-react-hooks"].rules)
    .map((rule) => rule.replace("react-hooks/", "@eslint-react/"))
    .filter((rule) => rule in reactStrict.rules)
    .map((rule) => [rule, "off"]),
);

/**
 * ESLint configuration for React code: ESLint React's strict type-checked preset and the
 * React team's hooks rules.
 *
 * @type {import("eslint").Linter.Config[]} */
export const config = [
  ...baseConfig,
  {
    ...reactStrict,
    files: ["**/*.{ts,tsx}"],
    rules: { ...reactStrict.rules, ...hookRulesOwnedByReactHooks },
  },
  pluginReactHooks.configs.flat.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
];
