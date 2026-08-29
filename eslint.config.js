import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // 参考/ holds third-party projects kept for reference (the PicaComic Tauri
  // client). Their lint errors are not ours to fix and drown out real ones.
  { ignores: ["dist", ".output", ".vinxi", "参考", "e2e/__report__", "e2e/__artifacts__"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  // Playwright specs and config run in Node, not the browser: they need
  // process/console, and they legitimately export non-components.
  {
    files: ["e2e/**/*.ts", "playwright.config.ts"],
    languageOptions: { globals: { ...globals.node } },
    rules: { "react-refresh/only-export-components": "off" },
  },
  eslintPluginPrettier,
);
