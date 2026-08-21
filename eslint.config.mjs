import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import prettier from "eslint-config-prettier/flat";

export default defineConfig([
  {
    // 빌드 산출물과 외부에서 받아 온 파일은 검사 대상이 아닙니다. 압축된
    // 라이브러리를 검사하면 실제 문제가 그 잡음에 묻힙니다.
    ignores: ["dist/**", "public/lib/**", "public/js/pace.js", "**/*.min.js"],
  },
  {
    // 서버 코드입니다.
    files: ["src/**/*.{js,mjs,cjs,ts,mts,cts}", "*.{js,mjs,cjs}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: globals.node },
  },
  {
    // 브라우저로 내려가는 코드입니다. 여기에 node 전역을 열어 두면
    // 브라우저에 없는 API를 써도 통과합니다.
    files: ["public/**/*.{js,mjs,cjs}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: globals.browser, sourceType: "module" },
  },
  {
    // typescript-eslint 규칙은 TS 파일에만 적용합니다. 전체에 걸면 브라우저용
    // .js에서도 base no-unused-vars가 TS 버전으로 교체되어, 기존 억제 주석이
    // 규칙 이름 불일치로 무력해집니다.
    files: ["**/*.{ts,mts,cts}"],
    extends: [tseslint.configs.recommended],
  },
  // 반드시 마지막입니다. prettier가 담당하는 서식 규칙을 꺼서 둘이 서로를
  // 되돌리는 것을 막습니다. prettier가 줄을 나눈 자리를 eslint가
  // no-unexpected-multiline으로 잡던 충돌이 실제로 있었습니다.
  prettier,
]);
