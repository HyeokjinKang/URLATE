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
import { errorHandler } from "./middleware";
import { URL } from "url";
import { createHash } from "crypto";

let branch;
exec("git branch --show-current", (err, stdout, stderr) => {
  if (err) {
    return (branch = "production");
  }
  return (branch = stdout.trim());
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const config = require(__dirname + "/../config/config.json");

let model;

// node-fetch has no default timeout: a hung backend would pin the request handler.
const API_TIMEOUT_MS = 5000;

const app = express();
app.locals.pretty = true;

// The rate limiter below keys on the client address, which arrives in
// X-Forwarded-For from the CDN and reverse proxy in front. Trusting more hops
// than actually exist would let a caller spoof it, so the count is configurable.
app.set("trust proxy", config.project.trustProxy ?? 1);

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
    ver: config.project.mode == "test" ? Date.now() : process.env.npm_package_version,
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
  res.render("join", { api: config.project.api, ver: config.project.mode == "test" ? Date.now() : process.env.npm_package_version, url: config.project.url });
});

const authRedirects: Record<string, string> = {
  "Not registered": `${config.project.url}/join`,
  "Not logined": config.project.url,
};

// Statuses that send the visitor elsewhere instead of rendering the page.
const gatedStatuses = new Set(Object.keys(authRedirects));

/**
 * Short-lived cache of the backend's auth status, keyed by the caller's cookies.
 *
 * Gated pages carry `no-store`, so the CDN in front cannot absorb them and every
 * navigation reaches this process. Without this cache each one would also cost a
 * round trip to the backend.
 *
 * Only statuses that let the visitor through are stored. Caching a gated status
 * would trap a user who just resolved it: finishing signup sends the browser to
 * /game, and a stale "Not registered" would bounce it back to /join, which sends
 * it to /game again. Gated statuses are rare and short-lived, so they are always
 * re-checked; the cache exists for the steady state of an ordinary player moving
 * between pages.
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
 * Bound how much backend traffic one address can generate through the gate.
 *
 * A cache miss costs a lookup against the backend, and a caller can force a miss
 * on every request just by varying the cookie it sends. One limiter is shared by
 * the gated pages, so the budget covers their combined load.
 */
const gateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Gate the pages that only make sense for a signed-in player.
 *
 * The status -> destination mapping is the one each page used to run in the
 * browser after loading. Doing it here means an unauthenticated request never
 * receives the page at all, so the check can no longer be skipped by disabling
 * JavaScript or dropping the redirect.
 */
const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  // The response depends on the session, so neither the CDN nor the browser may cache it.
  res.setHeader("Cache-Control", "no-store");
  if (!req.headers.cookie) return res.redirect(authRedirects["Not logined"]);

  const key = authCacheKey(req.headers.cookie);
  const cached = readCachedStatus(key);
  if (cached !== null) {
    const redirect = authRedirects[cached];
    if (redirect) return res.redirect(redirect);
    return next();
  }

  try {
    const response = await fetch(`${config.project.api}/auth/status`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Cookie: req.headers.cookie,
      },
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    if (!response.ok) return res.redirect(config.project.url);
    const data: any = await response.json();
    const status = String(data.status);
    writeCachedStatus(key, status);
    const redirect = authRedirects[status];
    if (redirect) return res.redirect(redirect);
    next();
  } catch (err) {
    // Fail closed: an unreachable backend must not open the gate.
    logger.warn("Failed to check auth status", { path: req.path, error: err });
    res.redirect(config.project.url);
  }
};

app.get("/game", gateLimiter, requireAuth, async (req, res) => {
  res.render("game", {
    cdn: config.project.cdn,
    url: config.project.url,
    api: config.project.api,
    game: config.project.game,
    ver: config.project.mode == "test" ? Date.now() : process.env.npm_package_version,
  });
});

app.get("/editor", gateLimiter, requireAuth, async (req, res) => {
  res.render("editor", {
    cdn: config.project.cdn,
    url: config.project.url,
    api: config.project.api,
    game: config.project.game,
    ver: config.project.mode == "test" ? Date.now() : process.env.npm_package_version,
  });
});

app.get("/test", gateLimiter, requireAuth, async (req, res) => {
  res.render("test", {
    cdn: config.project.cdn,
    url: config.project.url,
    api: config.project.api,
    game: config.project.game,
    ver: config.project.mode == "test" ? Date.now() : process.env.npm_package_version,
  });
});

app.get("/play", gateLimiter, requireAuth, async (req, res) => {
  res.render("play", {
    cdn: config.project.cdn,
    url: config.project.url,
    api: config.project.api,
    game: config.project.game,
    ver: config.project.mode == "test" ? Date.now() : process.env.npm_package_version,
  });
});

app.get("/tutorial", gateLimiter, requireAuth, async (req, res) => {
  res.render("tutorial", {
    cdn: config.project.cdn,
    url: config.project.url,
    api: config.project.api,
    game: config.project.game,
    ver: config.project.mode == "test" ? Date.now() : process.env.npm_package_version,
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
    filename: function (req, file, cb) {
      cb(null, Date.now() + ".webp");
    },
  }),
  limits: {
    fileSize: 3 * 1024 * 1024, // 3MB
  },
}).single("img");

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

app.post("/profile/:userid/:type", async (req, res) => {
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
      logger.error("Path traversal attempt detected", null, { userid: req.params.userid, filePath, ROOT });
      res.status(400).json({
        result: "failed",
        message: "Error occured while uploading",
        error: "Invalid file path",
      });
      return;
    }
    const fileBuffer: Buffer = await sharp(filePath)
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
    let explicit = false;
    if (predictions[0].className != "Drawing" && predictions[0].className != "Neutral") explicit = true;
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
      logger.info(`URLATE-v3l-frontend is running on version ${config.project.mode == "test" ? Date.now() : process.env.npm_package_version}.`);
      logger.success(`HTTP Server running at port ${config.project.port}.`);
    });
  } catch (err) {
    logger.fatal("Failed to initialize front-end server.", err);
    process.exit(1);
  }
})();

// Add error handler middleware (must be last)
app.use(errorHandler);
