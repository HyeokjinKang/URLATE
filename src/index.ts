import compression from "compression";
import cookieParser from "cookie-parser";
import express, { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import i18n from "./i18n";
import fetch from "node-fetch";
import { exec } from "child_process";
import { logger } from "./logger";
import {
  errorHandler,
  notFoundHandler,
  sendError,
  setStaticPageCsp,
} from "./middleware";
import { inlineCss } from "./assets";
import { initProfile, profileRouter } from "./profile";
import { URL } from "url";
import { createHash, randomBytes } from "crypto";

let branch;
exec("git branch --show-current", (err, stdout) => {
  if (err) {
    return (branch = "production");
  }
  return (branch = stdout.trim());
});

// config.json differs per deployment, so it can't be a static import target.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const config = require(__dirname + "/../config/config.json");

// eslint-disable-next-line @typescript-eslint/no-require-imports
const version = require(__dirname + "/../package.json").version;

// Must match the value the backend uses to verify the ID token, or login fails silently.
const googleClientId: string = config.google?.clientId;
if (!googleClientId) {
  logger.fatal("config.google.clientId is missing. Google login cannot work.");
  process.exit(1);
}

// node-fetch has no default timeout: a hung backend would pin the request handler.
const API_TIMEOUT_MS = 5000;

const app = express();
app.locals.pretty = true;
// Views embed their own stylesheets through this rather than linking them.
app.locals.inlineCss = inlineCss;
// Fonts come from the CDN, so every page opens the connection up front.
app.locals.cdn = config.project.cdn;

// Do not advertise the framework version.
app.disable("x-powered-by");

// Rate limiting keys on the client address, which arrives via X-Forwarded-For.
// Two hops answer for the CDN and the reverse proxy in front; trusting more
// than actually exist would let a caller spoof the address by sending it.
app.set("trust proxy", config.project.trustProxy ?? 2);

app.set("view engine", "ejs");
app.set("views", __dirname + "/../views");
app.use(cookieParser());

// Baseline security headers applied to every response. CSP itself is set per route.
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  // Only meaningful over HTTPS; browsers ignore it elsewhere. includeSubDomains is
  // left off because sibling hosts under the parent domain are not ours to commit.
  if (req.secure) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000");
  }
  next();
});

// Responses go out uncompressed otherwise: the CSS is render-blocking, so the
// bytes saved here come straight off first paint. Images and fonts are already
// compressed formats and are skipped by the mime-type check.
app.use(compression());

// Static assets are cache-busted via ?v=<ver>, so a long max-age is safe.
app.use(express.static(__dirname + "/../public", { maxAge: "7d" }));
app.use(i18n);

// Google Identity Services origin, used by the login button's script, style and frame.
const GSI_ORIGIN = "https://accounts.google.com";

/**
 * @param withGsi Whether the page uses Google Sign-In. The join page never calls
 *   GSI, so it has no reason to allow accounts.google.com.
 */
const authPageCsp = (nonce: string, withGsi: boolean) => {
  const gsi = (directive: string) => (withGsi ? ` ${directive}` : "");

  return [
    "default-src 'self'",
    // Allows the GSI client script and the page's own inline config script.
    `script-src 'self' 'nonce-${nonce}'${gsi(GSI_ORIGIN)}`,
    // The GSI button injects inline styles, so 'unsafe-inline' can't be narrowed to
    // a nonce. accounts.google.com also serves the button's stylesheet (/gsi/style).
    `style-src 'self' 'unsafe-inline'${gsi(GSI_ORIGIN)}`,
    `font-src 'self' ${config.project.cdn}`,
    "img-src 'self' data:",
    `connect-src 'self' ${config.project.api}${gsi(GSI_ORIGIN)}`,
    // The login button renders in an accounts.google.com iframe. The join page
    // uses no frames at all, so it blocks them outright.
    withGsi ? `frame-src ${GSI_ORIGIN}` : "frame-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "object-src 'none'",
  ].join("; ");
};

/**
 * Policy shared by the play screens (play/test/tutorial) and the editor. They
 * load the same assets, and their inline handlers use few enough origins that
 * merging with the account-page policy would only grant unused permissions.
 *
 * The editor's pattern download creates a blob URL, but it's only ever used
 * through <a download>, so it isn't a target for any fetch directive. socket.io
 * is served by this app itself, so script-src needs no external origin for it.
 */
const playPageCsp = (nonce: string) => {
  // socket.io connects over polling (https) before upgrading to a websocket, so
  // both schemes are needed -- allowing only one breaks either the initial
  // connection or the upgrade.
  const gameSocket = config.project.game.replace(/^https:/, "wss:");

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    // The Montserrat, Pretendard and Metropolis webfonts are all served from the CDN.
    `font-src 'self' ${config.project.cdn}`,
    // Album art and backgrounds come from the CDN.
    `img-src 'self' data: ${config.project.cdn}`,
    // Howler prefers Web Audio, which uses connect-src, but falls back to <audio>
    // (media-src) when that isn't supported. Both are allowed so playback works
    // either way.
    `media-src 'self' ${config.project.cdn}`,
    // Pattern/skin JSON and track files (CDN), the record/settings API, and the game socket.
    `connect-src 'self' ${config.project.api} ${config.project.cdn} ${config.project.game} ${gameSocket}`,
    "frame-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "object-src 'none'",
  ].join("; ");
};

// Generated fresh per request -- reusing it would let an attacker learn the
// value and pass off their own inline script, defeating the point of a nonce.
const withAuthPageCsp = (res: Response, withGsi: boolean): string => {
  const nonce = randomBytes(16).toString("base64");
  res.setHeader("Content-Security-Policy", authPageCsp(nonce, withGsi));
  return nonce;
};

/**
 * Policy for the game screen. Mostly the same as the play-screen policy, except
 * that profile pictures come from two places: uploads live on the CDN, while the
 * Google account picture captured at signup is served from googleusercontent.
 *
 * chart.js (the ranking graph) and socket.io are both served by this app itself,
 * so script-src needs no external origin for either. Merging this with the play
 * screens' policy would grant them origins they never use.
 */
const gamePageCsp = (nonce: string) => {
  const gameSocket = config.project.game.replace(/^https:/, "wss:");

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    // The Montserrat, Pretendard and Metropolis webfonts are all served from the CDN.
    `font-src 'self' ${config.project.cdn}`,
    // Album art and banners come from the CDN; profile pictures from the CDN or a Google account picture.
    `img-src 'self' data: ${config.project.cdn} https://*.googleusercontent.com`,
    `media-src 'self' ${config.project.cdn}`,
    `connect-src 'self' ${config.project.api} ${config.project.cdn} ${config.project.game} ${gameSocket}`,
    "frame-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "object-src 'none'",
  ].join("; ");
};

const withGamePageCsp = (res: Response): string => {
  const nonce = randomBytes(16).toString("base64");
  res.setHeader("Content-Security-Policy", gamePageCsp(nonce));
  return nonce;
};

const withPlayPageCsp = (res: Response): string => {
  const nonce = randomBytes(16).toString("base64");
  res.setHeader("Content-Security-Policy", playPageCsp(nonce));
  return nonce;
};

/**
 * Own budget for the login/join screens, separate from gateLimiter. That one
 * skips its count on an auth-cache hit, but every visitor here is signed out,
 * so that escape hatch never applies -- the limit is set generously so users
 * behind a shared address (e.g. a NAT) aren't locked out of signing in.
 */
const authPageLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 240,
  standardHeaders: true,
  legacyHeaders: false,
  // The default response is a bare line of text, which looks broken on a landing
  // page. Route it through the same error screen as everything else.
  handler: (req, res) => sendError(req, res, 429),
});

app.get("/", authPageLimiter, (req, res) => {
  res.render("index", {
    url: config.project.url,
    api: config.project.api,
    game: config.project.game,
    googleClientId: googleClientId,
    cspNonce: withAuthPageCsp(res, true),
    ver: config.project.mode == "test" ? Date.now() : version,
    branch: branch,
  });
});

app.get("/en", function (req, res) {
  res.cookie("lang", "en");
  res.redirect("/");
});

app.get("/ko", function (req, res) {
  res.cookie("lang", "ko");
  res.redirect("/");
});

app.get("/join", authPageLimiter, (req, res) => {
  res.render("join", {
    api: config.project.api,
    ver: config.project.mode == "test" ? Date.now() : version,
    url: config.project.url,
    cspNonce: withAuthPageCsp(res, false),
  });
});

const authRedirects: Record<string, string> = {
  "Not registered": `${config.project.url}/join`,
  "Not logined": config.project.url,
};

const gatedStatuses = new Set(Object.keys(authRedirects));

/**
 * Short-lived cache of the backend's auth status, keyed by the caller's cookies.
 * Gated pages are `no-store`, so without it every navigation costs a round trip.
 *
 * Only passing statuses are stored. A cached gated status would trap the user who
 * just resolved it: finishing signup sends the browser to /game, a stale
 * "Not registered" bounces it to /join, and /join sends it back to /game.
 */
const AUTH_CACHE_TTL_MS = 30 * 1000;
const AUTH_CACHE_MAX_ENTRIES = 5000;
const authStatusCache = new Map<
  string,
  { status: string; expiresAt: number }
>();

// Hashed so live session cookies are not held in memory for the TTL.
const authCacheKey = (cookie: string) =>
  createHash("sha256").update(cookie).digest("hex");

const readCachedStatus = (key: string): string | null => {
  const entry = authStatusCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    authStatusCache.delete(key);
    return null;
  }
  return entry.status;
};

const writeCachedStatus = (key: string, status: string) => {
  if (gatedStatuses.has(status)) return;
  // Re-insert so the cap evicts the least recently written entry.
  authStatusCache.delete(key);
  if (authStatusCache.size >= AUTH_CACHE_MAX_ENTRIES) {
    authStatusCache.delete(authStatusCache.keys().next().value);
  }
  authStatusCache.set(key, {
    status,
    expiresAt: Date.now() + AUTH_CACHE_TTL_MS,
  });
};

/**
 * Bound the backend traffic one address can drive through the gate: a cache miss
 * costs a lookup, and a caller can force one every time by varying the cookie.
 *
 * A cached pass never reaches the backend, so it does not spend from the budget.
 * That also keeps users behind one shared address from starving each other.
 */
const gateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  skip: (req) =>
    !!req.headers.cookie &&
    readCachedStatus(authCacheKey(req.headers.cookie)) !== null,
  standardHeaders: true,
  legacyHeaders: false,
});

// Its own budget, so a burst of page loads can never leave a visitor unable to sign out.
const logoutLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

// The gate could not reach a verdict. Say so instead of redirecting, which the
// browser would read as "you are not signed in".
const unavailable = (req: Request, res: Response) => {
  res.set("Retry-After", "5");
  sendError(req, res, 503);
};

/**
 * Gate the pages that only make sense for a signed-in player. Doing this
 * server-side means the check cannot be skipped by disabling JavaScript.
 */
const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  // Depends on the session, so neither the CDN nor the browser may cache it.
  res.setHeader("Cache-Control", "no-store");
  if (!req.headers.cookie) return res.redirect(authRedirects["Not logined"]);

  // Only passing statuses are cached, so a hit is a pass.
  const key = authCacheKey(req.headers.cookie);
  if (readCachedStatus(key) !== null) return next();

  try {
    const response = await fetch(`${config.project.api}/auth/status`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Cookie: req.headers.cookie,
      },
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    // A backend that is rate limiting or broken has not said anything about who
    // the caller is. Redirecting on it signs a valid session out of the page it
    // asked for -- and every gate lookup leaves this server's single address, so
    // the backend's per-address limit is reached by the site as a whole, not by
    // one visitor.
    if (response.status === 429 || response.status >= 500) {
      logger.warn("Auth status unavailable", {
        path: req.path,
        status: response.status,
      });
      return unavailable(req, res);
    }
    if (!response.ok) return res.redirect(config.project.url);
    const data = (await response.json()) as { status?: unknown };
    const status = data.status;
    if (typeof status !== "string") return res.redirect(config.project.url);
    writeCachedStatus(key, status);
    if (gatedStatuses.has(status)) return res.redirect(authRedirects[status]);
    next();
  } catch (err) {
    // Fail closed: an unreachable backend must not open the gate. It must not
    // claim the visitor is signed out either, so this is not a redirect.
    logger.warn("Failed to check auth status", { path: req.path, error: err });
    unavailable(req, res);
  }
};

const ownOrigin = (() => {
  try {
    return new URL(config.project.url).origin;
  } catch {
    return null;
  }
})();

// A top-level GET carries no Origin, so fall back to the Referer -- the same pair
// the backend reads on its own logout route.
const startedHere = (req: Request) => {
  const header = req.get("origin") ?? req.get("referer");
  if (!header || ownOrigin === null) return false;
  try {
    return new URL(header).origin === ownOrigin;
  } catch {
    return false;
  }
};

/**
 * Sign the visitor out. The backend still performs the real logout; this route
 * drops the session cookie and the cached status on the way there, so a destroyed
 * session stops passing the gate at once rather than when its entry expires.
 *
 * Those two are done only for a sign-out that started on our own pages, or a link
 * from anywhere else could sign a visitor out. The redirect stays unconditional,
 * so a request that fails the check behaves exactly as it did before this route
 * existed: the backend applies the same check and refuses.
 *
 * `sessionCookie` and `cookieDomain` must match what the backend sets; if they do
 * not the cookie survives and only the eviction takes effect.
 */
app.get("/logout", logoutLimiter, (req, res) => {
  if (startedHere(req)) {
    if (req.headers.cookie)
      authStatusCache.delete(authCacheKey(req.headers.cookie));
    const sessionCookie = config.project.sessionCookie ?? "urlate";
    res.clearCookie(sessionCookie, { path: "/" });
    if (config.project.cookieDomain)
      res.clearCookie(sessionCookie, {
        path: "/",
        domain: config.project.cookieDomain,
      });
  }

  res.redirect(`${config.project.api}/auth/logout?redirect=true`);
});

app.get("/game", gateLimiter, requireAuth, async (req, res) => {
  res.render("game", {
    cdn: config.project.cdn,
    url: config.project.url,
    api: config.project.api,
    game: config.project.game,
    cspNonce: withGamePageCsp(res),
    ver: config.project.mode == "test" ? Date.now() : version,
  });
});

app.get("/editor", gateLimiter, requireAuth, async (req, res) => {
  res.render("editor", {
    cdn: config.project.cdn,
    url: config.project.url,
    api: config.project.api,
    game: config.project.game,
    cspNonce: withPlayPageCsp(res),
    ver: config.project.mode == "test" ? Date.now() : version,
  });
});

app.get("/test", gateLimiter, requireAuth, async (req, res) => {
  res.render("test", {
    cdn: config.project.cdn,
    url: config.project.url,
    api: config.project.api,
    game: config.project.game,
    cspNonce: withPlayPageCsp(res),
    ver: config.project.mode == "test" ? Date.now() : version,
  });
});

app.get("/play", gateLimiter, requireAuth, async (req, res) => {
  res.render("play", {
    cdn: config.project.cdn,
    url: config.project.url,
    api: config.project.api,
    game: config.project.game,
    cspNonce: withPlayPageCsp(res),
    ver: config.project.mode == "test" ? Date.now() : version,
  });
});

app.get("/tutorial", gateLimiter, requireAuth, async (req, res) => {
  res.render("tutorial", {
    cdn: config.project.cdn,
    url: config.project.url,
    api: config.project.api,
    game: config.project.game,
    cspNonce: withPlayPageCsp(res),
    ver: config.project.mode == "test" ? Date.now() : version,
  });
});

app.get("/info", (req, res) => {
  setStaticPageCsp(res);
  res.render("info");
});

app.get("/privacy", (req, res) => {
  setStaticPageCsp(res);
  res.render("privacy");
});

app.use(profileRouter);

process.on(
  "unhandledRejection",
  (reason: unknown, promise: Promise<unknown>) => {
    logger.fatal("Unhandled Promise Rejection", reason, {
      promise: promise.toString(),
    });
  },
);

process.on("uncaughtException", (error: Error) => {
  logger.fatal("Uncaught Exception", error);
  process.exit(1);
});

(async () => {
  try {
    await initProfile();

    // Defaults to loopback since a reverse proxy sits in front; a wildcard bind
    // would expose the port directly regardless of firewall policy.
    const host = config.project.host ?? "127.0.0.1";
    app.listen(config.project.port, host, () => {
      logger.info(
        `URLATE-v3l-frontend is running on version ${config.project.mode == "test" ? Date.now() : version}.`,
      );
      logger.success(`HTTP Server running at ${host}:${config.project.port}.`);
    });
  } catch (err) {
    logger.fatal("Failed to initialize front-end server.", err);
    process.exit(1);
  }
})();

// Must come after the routes: placed earlier, every request would end in a 404.
app.use(notFoundHandler);

// Must be last.
app.use(errorHandler);
