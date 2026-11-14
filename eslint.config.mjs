import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import prettier from "eslint-config-prettier/flat";

export default defineConfig([
  {
    ignores: ["dist/**", "public/lib/**", "**/*.min.js"],
  },
  {
    files: ["src/**/*.{js,mjs,cjs,ts,mts,cts}", "*.{js,mjs,cjs}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["public/**/*.{js,mjs,cjs}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: globals.browser, sourceType: "module" },
  },
  {
    // typescript-eslint rules apply only to TS files. Applying them globally
    // would swap base no-unused-vars for the TS version even in browser .js
    // files, breaking existing suppression comments via the rule-name mismatch.
    files: ["**/*.{ts,mts,cts}"],
    extends: [tseslint.configs.recommended],
  },
  // Must stay last: it turns off the formatting rules prettier owns.
  prettier,
]);
