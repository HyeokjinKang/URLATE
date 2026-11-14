import { readFileSync } from "fs";
import path from "path";

const CSS_DIR = path.join(__dirname, "..", "public", "css");

const cache = new Map<string, string>();

const read = (name: string): string => {
  if (path.posix.basename(name) !== name || name.includes("..") || name.includes("\\")) {
    throw new Error(`Invalid stylesheet name: ${name}`);
  }

  const cached = cache.get(name);
  if (cached !== undefined) return cached;

  const css = readFileSync(path.join(CSS_DIR, `${name}.css`), "utf8");
  // A literal </style> would end the block early and leave the rest as markup.
  if (/<\/style/i.test(css)) {
    throw new Error(`${name}.css contains </style> and cannot be inlined.`);
  }
  cache.set(name, css);
  return css;
};

export const inlineCss = (...names: string[]): string => `<style>\n${names.map(read).join("\n")}</style>`;
