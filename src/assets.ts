import { readFileSync } from "fs";
import path from "path";

// config.json은 배포마다 내용이 달라 정적 import 대상이 아닙니다.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const config = require(__dirname + "/../config/config.json");

const CSS_DIR = path.join(__dirname, "..", "public", "css");

// Test builds bust every asset URL on each request, so re-read there too and let
// a stylesheet edit show up without restarting the process.
const CACHE = config.project.mode !== "test";

const cache = new Map<string, string>();

const read = (name: string): string => {
  const cached = cache.get(name);
  if (cached !== undefined) return cached;

  const css = readFileSync(path.join(CSS_DIR, `${name}.css`), "utf8");
  // A literal </style> would close the block early and leave the rest of the
  // stylesheet to be parsed as markup. None of ours contains one; if that ever
  // changes, fail on the first render rather than serve a broken page.
  if (/<\/style/i.test(css)) {
    throw new Error(`${name}.css contains </style> and cannot be inlined.`);
  }
  if (CACHE) cache.set(name, css);
  return css;
};

/**
 * Renders the named stylesheets as one <style> block, for views to embed.
 *
 * A <link rel="stylesheet"> holds back the first paint until the file comes
 * back, which costs a whole round trip after the HTML has already arrived --
 * about half of this page's first paint on a slow connection. Sending the rules
 * inside the HTML removes that request.
 *
 * Only worth doing for small stylesheets: the bytes ride along on every
 * navigation because the HTML is not cached, so the heavy screens (game,
 * editor) keep their <link>s and the browser cache that comes with them.
 *
 * Relative url() references would resolve against the page instead of /css/,
 * so only stylesheets using absolute asset paths can be passed here.
 */
export const inlineCss = (...names: string[]): string =>
  `<style>\n${names.map(read).join("\n")}</style>`;
