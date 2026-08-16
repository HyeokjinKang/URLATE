import cookieParser from "cookie-parser";
import express, { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import i18n from "./i18n";
import fetch from "node-fetch";
import { exec } from "child_process";
import { logger } from "./logger";
import { errorHandler, notFoundHandler, sendError } from "./middleware";
import { initProfile, profileRouter } from "./profile";
import { URL } from "url";
import { createHash, randomBytes } from "crypto";

let branch;
exec("git branch --show-current", (err, stdout, stderr) => {
  if (err) {
    return (branch = "production");
  }
  return (branch = stdout.trim());
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const config = require(__dirname + "/../config/config.json");

const version = require(__dirname + "/../package.json").version;

// 백엔드가 ID 토큰을 검증할 때 쓰는 값과 반드시 같아야 합니다. 템플릿에 직접
// 적어두면 한쪽만 바뀌었을 때 아무 오류 없이 로그인만 조용히 실패합니다.
const googleClientId: string = config.google?.clientId;
if (!googleClientId) {
  logger.fatal("config.google.clientId is missing. Google login cannot work.");
  process.exit(1);
}

// node-fetch has no default timeout: a hung backend would pin the request handler.
const API_TIMEOUT_MS = 5000;

const app = express();
app.locals.pretty = true;

// Do not advertise the framework version.
app.disable("x-powered-by");

// Rate limiting keys on the client address, which arrives via X-Forwarded-For.
// Two hops answer for the CDN and the reverse proxy in front; trusting more
// than actually exist would let a caller spoof the address by sending it.
app.set("trust proxy", config.project.trustProxy ?? 2);

app.set("view engine", "ejs");
app.set("views", __dirname + "/../views");
app.use(cookieParser());

// Baseline security headers. CSP is applied per-route on the account pages only;
// the rest still carry inline handlers (editor 136, game 97) that a global policy
// would break.
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

// Static assets are cache-busted via ?v=<ver>, so a long max-age is safe.
app.use(express.static(__dirname + "/../public", { maxAge: "7d" }));
app.use(i18n);

/**
 * 계정을 다루는 화면에만 거는 CSP입니다. 이 두 화면은 인라인 이벤트 핸들러가
 * 각각 하나뿐이라 정리 비용이 거의 없으면서, 탈취당했을 때 피해는 가장 큽니다.
 *
 * Chromium으로 두 화면을 실제로 열어 위반이 없는 것과, GSI 버튼이 그려지고
 * /auth/status 요청이 통과하는 것까지 확인한 뒤 강제 모드로 두었습니다.
 * 구글 로그인 완료 이후 경로는 자격증명이 필요해 검증하지 못했지만, 그 단계의
 * 요청도 /auth/status와 같은 오리진이라 connect-src가 이미 덮습니다.
 */
const authPageCsp = (nonce: string) =>
  [
    "default-src 'self'",
    // GSI 클라이언트와 페이지가 심는 전역 설정 스크립트를 허용합니다.
    `script-src 'self' 'nonce-${nonce}' https://accounts.google.com`,
    // GSI 버튼과 웹폰트 CSS가 인라인 스타일을 주입해 nonce로 좁힐 수 없습니다.
    // accounts.google.com은 GSI가 버튼 스타일시트(/gsi/style)를 받아오는 곳으로,
    // 빠뜨리면 강제 모드에서 로그인 버튼 모양이 깨집니다.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://accounts.google.com",
    "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net",
    "img-src 'self' data:",
    // jsdelivr는 개발자 도구를 열었을 때 폰트 CSS의 소스맵(/sm/*.map)을 받아옵니다.
    // 사용자 동작에는 영향이 없지만, 막아두면 콘솔에 위반이 쌓여 진짜 문제를 가립니다.
    // 이미 style-src·font-src로 신뢰하는 출처라 여기서 늘어나는 권한은 없습니다.
    `connect-src 'self' ${config.project.api} https://accounts.google.com https://cdn.jsdelivr.net`,
    // 로그인 버튼은 accounts.google.com iframe으로 그려집니다.
    "frame-src https://accounts.google.com",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "object-src 'none'",
  ].join("; ");

// 요청마다 새로 만듭니다. 재사용하면 공격자가 값을 알아내 인라인 스크립트를
// 통과시킬 수 있어 nonce의 의미가 사라집니다.
const withAuthPageCsp = (res: Response): string => {
  const nonce = randomBytes(16).toString("base64");
  res.setHeader("Content-Security-Policy", authPageCsp(nonce));
  return nonce;
};

app.get("/", (req, res) => {
  res.render("index", {
    url: config.project.url,
    api: config.project.api,
    game: config.project.game,
    googleClientId: googleClientId,
    cspNonce: withAuthPageCsp(res),
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

app.get("/join", (req, res) => {
  res.render("join", { api: config.project.api, ver: config.project.mode == "test" ? Date.now() : version, url: config.project.url, cspNonce: withAuthPageCsp(res) });
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

// Hashed so live session cookies are not held in memory for the TTL.
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
  if (authStatusCache.size >= AUTH_CACHE_MAX_ENTRIES) {
    authStatusCache.delete(authStatusCache.keys().next().value);
  }
  authStatusCache.set(key, { status, expiresAt: Date.now() + AUTH_CACHE_TTL_MS });
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
 * Gate the pages that only make sense for a signed-in player. The status ->
 * destination mapping is the one the pages used to run in the browser; doing it
 * here means the check cannot be skipped by disabling JavaScript.
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
      logger.warn("Auth status unavailable", { path: req.path, status: response.status });
      return unavailable(req, res);
    }
    if (!response.ok) return res.redirect(config.project.url);
    const data: any = await response.json();
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
    if (req.headers.cookie) authStatusCache.delete(authCacheKey(req.headers.cookie));
    const sessionCookie = config.project.sessionCookie ?? "urlate";
    res.clearCookie(sessionCookie, { path: "/" });
    if (config.project.cookieDomain) res.clearCookie(sessionCookie, { path: "/", domain: config.project.cookieDomain });
  }

  res.redirect(`${config.project.api}/auth/logout?redirect=true`);
});

app.get("/game", gateLimiter, requireAuth, async (req, res) => {
  res.render("game", {
    cdn: config.project.cdn,
    url: config.project.url,
    api: config.project.api,
    game: config.project.game,
    ver: config.project.mode == "test" ? Date.now() : version,
  });
});

app.get("/editor", gateLimiter, requireAuth, async (req, res) => {
  res.render("editor", {
    cdn: config.project.cdn,
    url: config.project.url,
    api: config.project.api,
    game: config.project.game,
    ver: config.project.mode == "test" ? Date.now() : version,
  });
});

app.get("/test", gateLimiter, requireAuth, async (req, res) => {
  res.render("test", {
    cdn: config.project.cdn,
    url: config.project.url,
    api: config.project.api,
    game: config.project.game,
    ver: config.project.mode == "test" ? Date.now() : version,
  });
});

app.get("/play", gateLimiter, requireAuth, async (req, res) => {
  res.render("play", {
    cdn: config.project.cdn,
    url: config.project.url,
    api: config.project.api,
    game: config.project.game,
    ver: config.project.mode == "test" ? Date.now() : version,
  });
});

app.get("/tutorial", gateLimiter, requireAuth, async (req, res) => {
  res.render("tutorial", {
    cdn: config.project.cdn,
    url: config.project.url,
    api: config.project.api,
    game: config.project.game,
    ver: config.project.mode == "test" ? Date.now() : version,
  });
});

app.get("/info", (req, res) => {
  res.render("info");
});

app.get("/privacy", (req, res) => {
  res.render("privacy");
});

app.use(profileRouter);

process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
  logger.fatal("Unhandled Promise Rejection", reason, { promise: promise.toString() });
});

process.on("uncaughtException", (error: Error) => {
  logger.fatal("Uncaught Exception", error);
  process.exit(1);
});

(async () => {
  try {
    await initProfile();

    // 리버스 프록시가 앞에 있으므로 기본값은 루프백입니다. 와일드카드로 열면
    // 포트가 방화벽 정책과 무관하게 외부에 그대로 노출됩니다.
    const host = config.project.host ?? "127.0.0.1";
    app.listen(config.project.port, host, () => {
      logger.info(`URLATE-v3l-frontend is running on version ${config.project.mode == "test" ? Date.now() : version}.`);
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
