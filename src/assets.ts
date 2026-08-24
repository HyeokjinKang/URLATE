import { readFileSync } from "fs";
import path from "path";

// config.json differs per deployment, so it can't be a static import target.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const config = require(__dirname + "/../config/config.json");

const CSS_DIR = path.join(__dirname, "..", "public", "css");

// Test builds re-read, so a stylesheet edit shows up without a restart.
const CACHE = config.project.mode !== "test";

const cache = new Map<string, string>();

const read = (name: string): string => {
  // Prevent path traversal (e.g. "../secrets") if a template ever passes a variable.
  if (
    path.posix.basename(name) !== name ||
    name.includes("..") ||
    name.includes("\\")
  ) {
    throw new Error(`Invalid stylesheet name: ${name}`);
  }

  const cached = cache.get(name);
  if (cached !== undefined) return cached;

  const css = readFileSync(path.join(CSS_DIR, `${name}.css`), "utf8");
  // A literal </style> would end the block early and leave the rest as markup.
  if (/<\/style/i.test(css)) {
    throw new Error(`${name}.css contains </style> and cannot be inlined.`);
  }
  if (CACHE) cache.set(name, css);
  return css;
};

/**
 * Renders the named stylesheets as one <style> block, for views to embed.
 *
 * Relative url() references would resolve against the page instead of /css/, so
 * only stylesheets using absolute asset paths can be passed here.
 */
export const inlineCss = (...names: string[]): string =>
  `<style>\n${names.map(read).join("\n")}</style>`;
