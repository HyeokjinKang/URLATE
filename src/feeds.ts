import fetch from "node-fetch";
import { logger } from "./logger";

/**
 * The landing page surfaces the two MIRAI feeds -- announcements and the blog --
 * above the fold. Both are fetched here on a timer and served from memory, so a
 * page render never waits on a network hop and a MIRAI outage costs the page
 * nothing but staleness.
 */

// Every link rendered from a feed is checked against this origin, so a poisoned
// or rewritten feed cannot put a `javascript:` or off-site URL on the page.
const MIRAI_ORIGIN = "https://mirai.urlate.coupy.dev";

// node-fetch has no default timeout: a hung MIRAI would pin the refresh forever.
const FEED_TIMEOUT_MS = 5000;
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

// A feed body larger than this is not a feed. Guards against a huge response
// being buffered into memory.
const MAX_FEED_BYTES = 512 * 1024;

// What the fold has room for. Both rails show the same count.
const ITEMS_PER_FEED = 3;

export type FeedKind = "announcements" | "journal";
export type FeedLang = "en" | "ko";

export interface FeedItem {
  /** Already decoded; the view escapes it on output. */
  title: string;
  /** Always an absolute MIRAI URL. */
  url: string;
  /** `YYYY.MM.DD`, for display. */
  date: string;
  /** `YYYY-MM-DD`, for the <time datetime> attribute. */
  iso: string;
}

const FEED_URLS: Record<FeedKind, Record<FeedLang, string>> = {
  announcements: {
    en: `${MIRAI_ORIGIN}/announcements/rss.xml`,
    ko: `${MIRAI_ORIGIN}/ko/announcements/rss.xml`,
  },
  journal: {
    en: `${MIRAI_ORIGIN}/rss.xml`,
    ko: `${MIRAI_ORIGIN}/ko/rss.xml`,
  },
};

const cache = new Map<string, FeedItem[]>();

const cacheKey = (kind: FeedKind, lang: FeedLang) => `${kind}:${lang}`;

/**
 * Reads a single tag's text out of one <item>. Feed titles are wrapped in CDATA
 * and links are not, so both forms are handled.
 */
const readTag = (item: string, tag: string): string | null => {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(item);
  if (!match) return null;
  const cdata = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(match[1]);
  return (cdata ? cdata[1] : match[1]).trim();
};

// The feed is XML, so the text arrives entity-encoded. The view escapes on
// output, which would render "&amp;" literally if it were left encoded here.
const decodeEntities = (text: string): string =>
  text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#0*39;/g, "'")
    .replace(/&amp;/g, "&");

// Announcement titles carry their own date prefix ("2025.05.17. | Title"), and
// the rail already sets the date in its own column.
const stripDatePrefix = (title: string): string =>
  title.replace(/^\s*\d{4}\s*\.\s*\d{1,2}\s*\.\s*\d{1,2}\s*\.?\s*\|\s*/, "");

const pad = (n: number) => String(n).padStart(2, "0");

const parseFeed = (xml: string): FeedItem[] => {
  const items: FeedItem[] = [];

  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = match[1];
    const rawTitle = readTag(block, "title");
    const rawLink = readTag(block, "link");
    const rawDate = readTag(block, "pubDate");
    if (!rawTitle || !rawLink || !rawDate) continue;

    // An entry pointing anywhere but MIRAI is not ours to render.
    let url: URL;
    try {
      url = new URL(decodeEntities(rawLink));
    } catch {
      continue;
    }
    if (url.origin !== MIRAI_ORIGIN) continue;

    const published = new Date(decodeEntities(rawDate));
    if (Number.isNaN(published.getTime())) continue;

    const title = stripDatePrefix(decodeEntities(rawTitle));
    if (!title) continue;

    // UTC throughout, so the rendered date does not depend on the server's zone.
    const y = published.getUTCFullYear();
    const m = pad(published.getUTCMonth() + 1);
    const d = pad(published.getUTCDate());

    items.push({
      title,
      url: url.href,
      date: `${y}.${m}.${d}`,
      iso: `${y}-${m}-${d}`,
    });

    if (items.length === ITEMS_PER_FEED) break;
  }

  return items;
};

const refreshOne = async (kind: FeedKind, lang: FeedLang): Promise<void> => {
  const url = FEED_URLS[kind][lang];
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
      size: MAX_FEED_BYTES,
    });
    if (!response.ok) {
      logger.warn("MIRAI feed unavailable", { url, status: response.status });
      return;
    }
    const items = parseFeed(await response.text());
    // An empty parse is more likely a changed feed shape than an emptied feed;
    // keeping the last good items beats blanking the fold.
    if (items.length === 0) {
      logger.warn("MIRAI feed parsed to nothing", { url });
      return;
    }
    cache.set(cacheKey(kind, lang), items);
  } catch (err) {
    // Stale entries stay in place -- the page renders what it last knew.
    logger.warn("Failed to refresh MIRAI feed", { url, error: err });
  }
};

const refreshAll = async (): Promise<void> => {
  await Promise.all(
    (Object.keys(FEED_URLS) as FeedKind[]).flatMap((kind) =>
      (["en", "ko"] as FeedLang[]).map((lang) => refreshOne(kind, lang)),
    ),
  );
};

/**
 * Warms the cache once, then keeps it warm. A failed warm-up is not fatal: the
 * rails render their empty state and the next tick tries again.
 */
export const initFeeds = async (): Promise<void> => {
  await refreshAll();
  // Unref'd so the interval alone never keeps the process alive.
  setInterval(() => void refreshAll(), REFRESH_INTERVAL_MS).unref();
};

/** Never null -- an unfetched or failing feed reads as an empty rail. */
export const getFeed = (kind: FeedKind, lang: FeedLang): FeedItem[] =>
  cache.get(cacheKey(kind, lang)) ?? [];

/** Where "see all" on each rail points. */
export const feedIndexUrl = (kind: FeedKind, lang: FeedLang): string => {
  const prefix = lang === "ko" ? `${MIRAI_ORIGIN}/ko` : MIRAI_ORIGIN;
  return kind === "announcements" ? `${prefix}/announcements` : `${prefix}/`;
};
