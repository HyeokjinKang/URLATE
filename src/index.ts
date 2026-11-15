import compression from "compression";
import cookieParser from "cookie-parser";
import express, { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import i18n from "./i18n";
import { exec } from "child_process";
import { logger } from "./logger";
import { visitorHeaders } from "./visitor";
import { errorHandler, notFoundHandler, sendError, setStaticPageCsp } from "./middleware";
import { inlineCss } from "./assets";
import { initProfile, profileRouter } from "./profile";
import { URL } from "url";
import { createHash, randomBytes } from "crypto";

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

// fetch has no default timeout: a hung backend would pin the request handler.
const API_TIMEOUT_MS = 5000;

const app = express();

app.disable("x-powered-by");

// Rate limiting keys on the client address, which arrives via X-Forwarded-For.
// Two hops answer for the CDN and the reverse proxy in front; trusting more
// than actually exist would let a caller spoof the address by sending it.
app.set("trust proxy", config.project.trustProxy ?? 2);

app.set("view engine", "ejs");
app.set("view cache", true);
app.set("views", __dirname + "/../views");
app.use(cookieParser());

app.locals.url = config.project.url;
app.locals.api = config.project.api;
app.locals.game = config.project.game;
app.locals.cdn = config.project.cdn;
app.locals.inlineCss = inlineCss;
app.locals.ver = version;
app.locals.branch = "main";
exec("git branch --show-current", (err, stdout) => {
  if (!err) app.locals.branch = stdout.trim();
});

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

app.use(compression());
app.use(express.static(__dirname + "/../public"));
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache");
  next();
});
app.use(i18n);

const GSI_ORIGIN = "https://accounts.google.com";

// socket.io starts over https polling and then upgrades to a websocket, so both schemes are needed.
const GAME_SOCKET = config.project.game.replace(/^https:/, "wss:");

type CspSources = {
  script?: string[];
  style?: string[];
  img?: string[];
  media?: boolean;
  connect: string[];
  frame: string;
};

const buildCsp = (nonce: string, sources: CspSources) => {
  const list = (origins: string[] = []) => origins.map((origin) => ` ${origin}`).join("");
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${list(sources.script)}`,
    // The GSI button injects inline styles, so 'unsafe-inline' can't be narrowed to a nonce.
    `style-src 'self' 'unsafe-inline'${list(sources.style)}`,
    `font-src 'self' ${config.project.cdn}`,
    `img-src 'self' data:${list(sources.img)}`,
    // Howler falls back to <audio> (media-src) when Web Audio (connect-src) is unavailable.
    ...(sources.media ? [`media-src 'self' ${config.project.cdn}`] : []),
    `connect-src 'self'${list(sources.connect)}`,
    `frame-src ${sources.frame}`,
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "object-src 'none'",
  ].join("; ");
};

const authPageCsp = (nonce: string, withGsi: boolean) => {
  const gsi = withGsi ? [GSI_ORIGIN] : [];
  return buildCsp(nonce, {
    script: gsi,
    style: gsi,
    connect: [config.project.api, ...gsi],
    frame: withGsi ? GSI_ORIGIN : "'none'",
  });
};

const gameConnect = [config.project.api, config.project.cdn, config.project.game, GAME_SOCKET];

const playPageCsp = (nonce: string) =>
  buildCsp(nonce, { img: [config.project.cdn], media: true, connect: gameConnect, frame: "'none'" });

const gamePageCsp = (nonce: string) =>
  buildCsp(nonce, {
    img: [config.project.cdn, "https://*.googleusercontent.com"],
    media: true,
    connect: gameConnect,
    frame: "'none'",
  });

const withCsp = (res: Response, policy: (nonce: string) => string): string => {
  const nonce = randomBytes(16).toString("base64");
  res.setHeader("Content-Security-Policy", policy(nonce));
  return nonce;
};

const withAuthPageCsp = (res: Response, withGsi: boolean) => withCsp(res, (nonce) => authPageCsp(nonce, withGsi));
const withGamePageCsp = (res: Response) => withCsp(res, gamePageCsp);
const withPlayPageCsp = (res: Response) => withCsp(res, playPageCsp);

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
  handler: (req, res) => sendError(req, res, 429),
});

app.get("/", authPageLimiter, (req, res) => {
  res.render("index", {
    googleClientId: googleClientId,
    cspNonce: withAuthPageCsp(res, true),
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
const authStatusCache = new Map<string, { status: string; expiresAt: number }>();

const authCacheKey = (cookie: string) => createHash("sha256").update(cookie).digest("hex");

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
  const oldest = authStatusCache.keys().next().value;
  if (authStatusCache.size >= AUTH_CACHE_MAX_ENTRIES && oldest !== undefined) {
    authStatusCache.delete(oldest);
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
  skip: (req) => !!req.headers.cookie && readCachedStatus(authCacheKey(req.headers.cookie)) !== null,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => sendError(req, res, 429),
});

const logoutLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => sendError(req, res, 429),
});

const unavailable = (req: Request, res: Response) => {
  res.set("Retry-After", "5");
  sendError(req, res, 503);
};

/**
 * Gate the pages that only make sense for a signed-in player. Doing this
 * server-side means the check cannot be skipped by disabling JavaScript.
 */
const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
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
        ...visitorHeaders(req),
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
    if (req.headers.cookie) authStatusCache.delete(authCacheKey(req.headers.cookie));
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
    cspNonce: withGamePageCsp(res),
  });
});

app.get("/editor", gateLimiter, requireAuth, async (req, res) => {
  res.render("editor", {
    cspNonce: withPlayPageCsp(res),
  });
});

app.get("/test", gateLimiter, requireAuth, async (req, res) => {
  res.render("player", {
    mode: "test",
    cspNonce: withPlayPageCsp(res),
  });
});

app.get("/play", gateLimiter, requireAuth, async (req, res) => {
  res.render("player", {
    mode: "play",
    cspNonce: withPlayPageCsp(res),
  });
});

app.get("/tutorial", gateLimiter, requireAuth, async (req, res) => {
  res.render("player", {
    mode: "tutorial",
    cspNonce: withPlayPageCsp(res),
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

app.get("/privacy/2023-08-02", (req, res) => {
  setStaticPageCsp(res);
  res.render("privacy-2023-08-02");
});

app.use(profileRouter);

process.on("unhandledRejection", (reason: unknown, promise: Promise<unknown>) => {
  logger.fatal("Unhandled Promise Rejection", reason, {
    promise: promise.toString(),
  });
});

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
      logger.info(`URLATE is running on version ${version}.`);
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
