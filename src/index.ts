import cookieParser from "cookie-parser";
import express, { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import i18n from "./i18n";
import multer from "multer";
import path from "path";
import fetch from "node-fetch";
import { exec } from "child_process";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-wasm";
import * as nsfw from "nsfwjs";
import fs from "fs";
import sharp from "sharp";
import { logger } from "./logger";
import { errorHandler, notFoundHandler, sendError } from "./middleware";
import { URL } from "url";
import { createHash, randomUUID } from "crypto";

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

let model;

// node-fetch has no default timeout: a hung backend would pin the request handler.
const API_TIMEOUT_MS = 5000;

const app = express();
app.locals.pretty = true;

// 버전 노출을 막습니다.
app.disable("x-powered-by");

// Rate limiting keys on the client address, which arrives via X-Forwarded-For.
// Two hops answer for the CDN and the reverse proxy in front; trusting more
// than actually exist would let a caller spoof the address by sending it.
app.set("trust proxy", config.project.trustProxy ?? 2);

app.set("view engine", "ejs");
app.set("views", __dirname + "/../views");
app.use(cookieParser());

// Baseline security headers (CSP omitted: inline event handlers require a larger refactor).
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// Static assets are cache-busted via ?v=<ver>, so a long max-age is safe.
app.use(express.static(__dirname + "/../public", { maxAge: "7d" }));
app.use(i18n);

app.get("/", (req, res) => {
  res.render("index", {
    url: config.project.url,
    api: config.project.api,
    game: config.project.game,
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
  res.render("join", { api: config.project.api, ver: config.project.mode == "test" ? Date.now() : version, url: config.project.url });
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

/**
 * An upload costs a 3MB write, a sharp re-encode and an NSFW inference, and the
 * file it leaves behind is served from our own origin. Cheap for the caller,
 * expensive for us -- so it gets a budget of its own, well below the gate's.
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
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

const upload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      const dirPath = path.join(__dirname, "..", "public", "images", "profiles");
      fs.mkdir(dirPath, { recursive: true }, (err) => {
        if (err) {
          logger.error("Profile update API error", err, {
            message: "Failed to create profile image directory.",
            userid: req.params.userid,
          });
          return cb(err, dirPath);
        }
        cb(null, dirPath);
      });
    },
    // Date.now() alone collides: two uploads in the same millisecond overwrite
    // each other's image.
    filename: function (req, file, cb) {
      cb(null, `${Date.now()}-${randomUUID()}.webp`);
    },
  }),
  limits: {
    fileSize: 3 * 1024 * 1024, // 3MB
  },
  // Rejecting here keeps a non-image from ever reaching the disk; the handler's
  // own check runs after multer has already written the file.
  fileFilter: function (req, file, cb) {
    cb(null, file.mimetype.indexOf("image") === 0);
  },
}).single("img");

// multer writes the upload to disk before the handler runs, so every path that
// rejects the request afterwards has to remove it or the bytes stay forever.
const discardUpload = (file: Express.Multer.File | undefined) => {
  if (!file?.path) return;
  fs.promises.unlink(file.path).catch((err) => {
    if (err.code !== "ENOENT") logger.warn("Failed to remove a rejected upload", { path: file.path, error: err });
  });
};

const imageToTensor = async (fileBuffer) => {
  const { data, info } = await sharp(fileBuffer).raw().toBuffer({ resolveWithObject: true });

  return tf.tensor3d(new Uint8Array(data), [info.height, info.width, info.channels], "int32");
};

/**
 * Resolve the caller's identity from the backend session.
 *
 * This route supplies the backend's project secret on the caller's behalf, so
 * the `:userid` path segment must never be trusted. The browser already sends
 * its session cookie here, so forward it and let the backend session decide.
 */
const resolveSessionUserid = async (req): Promise<string | null> => {
  if (!req.headers.cookie) return null;
  try {
    const response = await fetch(`${config.project.api}/user`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Cookie: req.headers.cookie,
      },
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const data: any = await response.json();
    if (data.result !== "success" || !data.user || !data.user.userid) return null;
    return String(data.user.userid);
  } catch (err) {
    logger.warn("Failed to resolve session userid", { error: err });
    return null;
  }
};

app.post("/profile/:userid/:type", uploadLimiter, async (req, res) => {
  // Validate userid: must be numeric
  if (!/^[0-9]+$/.test(req.params.userid)) {
    res.status(400).json({
      result: "failed",
      message: "Invalid userid format",
      error: "Bad userid",
    });
    return;
  }

  // Authenticate before multer, sharp and the NSFW model spend any work.
  const sessionUserid = await resolveSessionUserid(req);
  if (!sessionUserid) {
    res.status(401).json({
      result: "failed",
      message: "Login required",
      error: "Unauthorized",
    });
    return;
  }
  if (sessionUserid !== req.params.userid) {
    logger.warn("Rejected profile upload for a different user", {
      sessionUserid,
      requested: req.params.userid,
    });
    res.status(403).json({
      result: "failed",
      message: "You can only update your own profile",
      error: "Forbidden",
    });
    return;
  }

  let type = "";
  let width = 256;
  let height = 256;
  if (req.params.type == "picture") {
    type = "picture";
  } else if (req.params.type == "background") {
    width = 2560;
    height = null;
    type = "background";
  } else {
    res.status(400).json({
      result: "failed",
      message: "Error occured while uploading",
      error: "Invalid type",
    });
    return;
  }

  // Fetch existing profile/background URL before upload
  let oldFileUrl: string | null = null;
  try {
    const profileResponse = await fetch(`${config.project.api}/profile/${req.params.userid}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    const profileData: any = await profileResponse.json();
    if (profileData.result === "success" && profileData.user && profileData.user[type] && !config.project.ignoredImageURL.some((domain) => profileData.user[type].includes(domain))) {
      oldFileUrl = profileData.user[type];
    }
  } catch (err) {
    logger.warn("Failed to fetch existing profile data", { userid: req.params.userid, type, error: err });
  }

  upload(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) err = err.message;
      else err = err.code;
      discardUpload(req.file);
      logger.error("File upload error", err, { userid: req.params.userid, type: req.params.type });
      res.status(400).json({
        result: "failed",
        message: "Error occured while uploading",
        error: err,
      });
      return;
    }
    const file = req.file;
    if (!file || file.mimetype.indexOf("image") == -1) {
      discardUpload(file);
      logger.warn("Invalid file upload attempt", { userid: req.params.userid, type: req.params.type, mimetype: file?.mimetype });
      res.status(400).json({
        result: "failed",
        message: "Error occured while uploading",
        error: "Invalid file type",
      });
      return;
    }
    const ROOT = __dirname.split("/").slice(0, -1).join("/") + "/public/images/profiles";
    const filePath = fs.realpathSync(path.resolve(ROOT, file.path));
    if (!filePath.startsWith(ROOT)) {
      discardUpload(file);
      logger.error("Path traversal attempt detected", null, { userid: req.params.userid, filePath, ROOT });
      res.status(400).json({
        result: "failed",
        message: "Error occured while uploading",
        error: "Invalid file path",
      });
      return;
    }

    // multer's callback is not an Express handler, so a rejection here is not
    // turned into a response -- the request would hang and the file would stay.
    let fileBuffer: Buffer;
    let explicit = false;
    try {
      fileBuffer = await sharp(filePath)
        .resize({ width, height })
        .flatten({ background: "#ffffff" })
        .webp({
          quality: 70,
          effort: 6,
        })
        .toBuffer();
      fs.writeFileSync(filePath, fileBuffer);
      const image = await imageToTensor(fileBuffer);
      const predictions = await model.classify(image);
      image.dispose();
      if (predictions[0].className != "Drawing" && predictions[0].className != "Neutral") explicit = true;
    } catch (e) {
      discardUpload(file);
      logger.error("Failed to process the uploaded image", e, { userid: req.params.userid, type: req.params.type });
      res.status(400).json({
        result: "failed",
        message: "Error occured while uploading",
        error: "Invalid image",
      });
      return;
    }

    fetch(`${config.project.api}/profile/${type}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
      body: JSON.stringify({
        explicit,
        // Verified against the backend session, never the raw path segment.
        userid: sessionUserid,
        value: `${config.project.url}/images/profiles/${file.filename}`,
        secret: config.project.secretKey,
      }),
    })
      .then((res) => res.json())
      .then((json: any) => {
        if (json.result == "failed") {
          discardUpload(file);
          logger.error("Profile update API error", null, { message: json.message, userid: req.params.userid });
          res.status(400).json({
            result: "failed",
            message: "Error occured while uploading",
            error: json.message,
          });
          return;
        }

        // Delete old file after successful upload
        if (oldFileUrl) {
          // Asynchronously delete the old file without blocking the response.
          (async () => {
            try {
              const { realpath, unlink } = fs.promises;
              const profilesDir = path.join(__dirname, "../public/images/profiles");
              const rootPath = await realpath(profilesDir);

              const oldFilename = path.basename(new URL(oldFileUrl).pathname);
              const oldFilePath = path.join(profilesDir, oldFilename);

              const resolvedPath = await realpath(oldFilePath);

              if (resolvedPath.startsWith(rootPath)) {
                await unlink(resolvedPath);
                logger.info(`Deleted old ${type} file`, { userid: req.params.userid, oldFilename });
              } else {
                logger.warn("Skipping deletion of file outside the root directory.", { userid: req.params.userid, oldFileUrl, resolvedPath });
              }
            } catch (err) {
              // It's okay if the file doesn't exist. Log other errors.
              if (err.code !== "ENOENT") {
                logger.warn(`Failed to delete old ${type} file`, { userid: req.params.userid, oldFileUrl, error: err });
              }
            }
          })();
        }

        res.status(200).json({ result: "success", url: `${config.project.url}/images/profiles/${file.filename}`, explicit });
      })
      .catch((err) => {
        discardUpload(file);
        logger.error("Profile update fetch error", err, { userid: req.params.userid });
        res.status(500).json({
          result: "failed",
          message: "Error occured while uploading",
          error: "Internal server error",
        });
      });
  });
});

const loadModel = async () => {
  model = await nsfw.load(`${config.project.nsfw}/mobilenet_v2/`);
};

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
  logger.fatal("Unhandled Promise Rejection", reason, { promise: promise.toString() });
});

// Handle uncaught exceptions
process.on("uncaughtException", (error: Error) => {
  logger.fatal("Uncaught Exception", error);
  process.exit(1);
});

(async () => {
  try {
    await tf.setBackend("wasm");
    await tf.ready();

    await loadModel();

    app.listen(config.project.port, () => {
      logger.info(`URLATE-v3l-frontend is running on version ${config.project.mode == "test" ? Date.now() : version}.`);
      logger.success(`HTTP Server running at port ${config.project.port}.`);
    });
  } catch (err) {
    logger.fatal("Failed to initialize front-end server.", err);
    process.exit(1);
  }
})();

// 라우트 뒤에 와야 합니다. 앞에 두면 모든 요청이 404로 끝납니다.
app.use(notFoundHandler);

// Add error handler middleware (must be last)
app.use(errorHandler);
