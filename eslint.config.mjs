// @ts-check
import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

/**
 * Single root ESLint config for the pnpm workspace.
 * Packages inherit this; do not add per-app eslintrc files. The mobile app
 * gets the React hooks rules on top (block below).
 */
export default defineConfig(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/coverage/**",
      "pnpm-lock.yaml",
      ".agents/**",
      "apps/api/src/admin/smoketests/**",
      // Same standalone-script pattern as smoketests (manual mongoose model
      // wiring outside Nest's DI container, not a throwaway test) — not in
      // that directory since it writes permanent seed data, not test data.
      "apps/api/src/admin/seed-common-products.ts",
      "apps/api/src/admin/seed-rule-explainers.ts",
      // Expo template examples kept for reference (gitignored) + generated.
      "apps/mobile/example/**",
      "apps/mobile/.expo/**",
      "apps/mobile/expo-env.d.ts",
    ],
  },
  {
    files: ["**/*.{js,cjs,mjs,ts,cts,mts,tsx}"],
    extends: [eslint.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },
  {
    files: ["apps/mobile/**/*.{ts,tsx}"],
    extends: [reactHooks.configs.flat["recommended-latest"]],
  },
  eslintConfigPrettier
);
