import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import prettier from "eslint-config-prettier/flat";

export default defineConfig([
  {
    // Build output and vendored files aren't lint targets.
    ignores: ["dist/**", "public/lib/**", "public/js/pace.js", "**/*.min.js"],
  },
  {
    // Server code.
    files: ["src/**/*.{js,mjs,cjs,ts,mts,cts}", "*.{js,mjs,cjs}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: globals.node },
  },
  {
    // Code shipped to the browser.
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
  // Must stay last. Turns off formatting rules prettier owns, so the two
  // don't fight each other. This was a real conflict: eslint's
  // no-unexpected-multiline was flagging line breaks prettier inserted.
  prettier,
]);
