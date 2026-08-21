import { Router } from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";
import path from "path";
import fetch from "node-fetch";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-wasm";
import * as nsfw from "nsfwjs";
import sharp from "sharp";
import { logger } from "./logger";
import { URL } from "url";
import { randomUUID } from "crypto";

// config.json은 배포마다 내용이 달라 정적 import 대상이 아닙니다.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const config = require(__dirname + "/../config/config.json");

// node-fetch has no default timeout: a hung backend would pin the request handler.
const API_TIMEOUT_MS = 5000;

let model;

/**
 * An upload costs a 3MB read, a sharp re-encode, an NSFW inference and a push to
 * the CDN storage zone. Cheap for the caller, expensive for us -- so it gets a
 * budget of its own, well below the gate's.
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const BUNNY_PATH = String(config.bunny?.path ?? "profiles").replace(
  /^\/+|\/+$/g,
  "",
);

// A storage upload pushes up to 3MB over the network, so it needs more room than
// a backend call.
const BUNNY_TIMEOUT_MS = 15000;

// Only files we uploaded may be deleted. A name that does not match may be a
// default image or an avatar we do not own.
const PROFILE_FILENAME =
  /^[0-9]+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

// Never deleted, whatever a profile points at. pfp.webp is the shared default
// picture: removing it would blank out every user still on it.
const PROTECTED_FILENAMES = new Set(["pfp.webp"]);

const bunnyStorageUrl = (filename: string) =>
  `https://${config.bunny.endpoint}/${config.bunny.storageZone}/${BUNNY_PATH}/${filename}`;

// The address browsers fetch: a pull zone sits in front of the storage zone.
const bunnyPublicUrl = (filename: string) =>
  `${config.project.cdn}/${BUNNY_PATH}/${filename}`;

const uploadToBunny = async (filename: string, buffer: Buffer) => {
  const response = await fetch(bunnyStorageUrl(filename), {
    method: "PUT",
    headers: {
      AccessKey: config.bunny.accessKey,
      "Content-Type": "image/webp",
    },
    body: buffer,
    signal: AbortSignal.timeout(BUNNY_TIMEOUT_MS),
  });
  if (!response.ok)
    throw new Error(`BunnyCDN storage responded with ${response.status}`);
};

const deleteFromBunny = async (filename: string) => {
  const response = await fetch(bunnyStorageUrl(filename), {
    method: "DELETE",
    headers: { AccessKey: config.bunny.accessKey },
    signal: AbortSignal.timeout(BUNNY_TIMEOUT_MS),
  });
  // A file that is already gone answers 404, which is the state we wanted.
  if (!response.ok && response.status !== 404)
    throw new Error(`BunnyCDN storage responded with ${response.status}`);
};

// Once the file is in the storage zone, a later failure would leave it there
// unreferenced. Clean up behind the response instead of holding it.
const discardUpload = (
  filename: string | null,
  context: Record<string, unknown>,
) => {
  if (!filename) return;
  deleteFromBunny(filename).catch((err) => {
    logger.warn("Failed to remove a rejected upload from BunnyCDN", {
      ...context,
      filename,
      error: err,
    });
  });
};

// The storage zone file a previous profile URL points at, but only when we
// uploaded it. Default images and external avatars return null and are left alone.
const oldStorageFile = (fileUrl: string): string | null => {
  if (!fileUrl.startsWith(`${config.project.cdn}/${BUNNY_PATH}/`)) return null;
  let filename: string;
  try {
    filename = path.basename(new URL(fileUrl).pathname);
  } catch {
    return null;
  }
  if (PROTECTED_FILENAMES.has(filename) || !PROFILE_FILENAME.test(filename))
    return null;
  return filename;
};

const upload = multer({
  // The file never touches the disk: sharp reads the buffer and only the result
  // is pushed to the storage zone.
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 3 * 1024 * 1024, // 3MB
  },
  // Rejecting here keeps a non-image from ever being buffered; the handler's
  // own check runs after multer has already read the file.
  fileFilter: function (req, file, cb) {
    cb(null, file.mimetype.indexOf("image") === 0);
  },
}).single("img");

const imageToTensor = async (fileBuffer) => {
  const { data, info } = await sharp(fileBuffer)
    .raw()
    .toBuffer({ resolveWithObject: true });

  return tf.tensor3d(
    new Uint8Array(data),
    [info.height, info.width, info.channels],
    "int32",
  );
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
    const data = (await response.json()) as {
      result?: unknown;
      user?: { userid?: unknown };
    };
    if (data.result !== "success" || !data.user || !data.user.userid)
      return null;
    return String(data.user.userid);
  } catch (err) {
    logger.warn("Failed to resolve session userid", { error: err });
    return null;
  }
};

const assertBunnyConfig = () => {
  const missing = ["endpoint", "storageZone", "accessKey"].filter(
    (key) => !config.bunny?.[key],
  );
  if (missing.length)
    throw new Error(
      `Missing BunnyCDN storage config: bunny.${missing.join(", bunny.")}`,
    );
};

// Config check and model load have to finish before the server accepts traffic:
// learning about a broken storage config on the first upload is too late.
export const initProfile = async () => {
  assertBunnyConfig();

  await tf.setBackend("wasm");
  await tf.ready();

  model = await nsfw.load(`${config.project.nsfw}/mobilenet_v2/`);
};

export const profileRouter = Router();

profileRouter.post(
  "/profile/:userid/:type",
  uploadLimiter,
  async (req, res) => {
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

    let oldFileUrl: string | null = null;
    try {
      const profileResponse = await fetch(
        `${config.project.api}/profile/${req.params.userid}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(API_TIMEOUT_MS),
        },
      );
      const profileData = (await profileResponse.json()) as {
        result?: unknown;
        user?: Record<string, string | undefined>;
      };
      if (
        profileData.result === "success" &&
        profileData.user &&
        profileData.user[type]
      ) {
        oldFileUrl = profileData.user[type];
      }
    } catch (err) {
      logger.warn("Failed to fetch existing profile data", {
        userid: req.params.userid,
        type,
        error: err,
      });
    }

    upload(req, res, async (err) => {
      if (err) {
        if (err instanceof multer.MulterError) err = err.message;
        else err = err.code;
        logger.error("File upload error", err, {
          userid: req.params.userid,
          type: req.params.type,
        });
        res.status(400).json({
          result: "failed",
          message: "Error occured while uploading",
          error: err,
        });
        return;
      }
      const file = req.file;
      if (!file || file.mimetype.indexOf("image") == -1) {
        logger.warn("Invalid file upload attempt", {
          userid: req.params.userid,
          type: req.params.type,
          mimetype: file?.mimetype,
        });
        res.status(400).json({
          result: "failed",
          message: "Error occured while uploading",
          error: "Invalid file type",
        });
        return;
      }

      // multer's callback is not an Express handler, so a rejection here is not
      // turned into a response -- the request would hang.
      let fileBuffer: Buffer;
      let explicit = false;
      try {
        fileBuffer = await sharp(file.buffer)
          .resize({ width, height })
          .flatten({ background: "#ffffff" })
          .webp({
            quality: 70,
            effort: 6,
          })
          .toBuffer();
        const image = await imageToTensor(fileBuffer);
        const predictions = await model.classify(image);
        image.dispose();
        if (
          predictions[0].className != "Drawing" &&
          predictions[0].className != "Neutral"
        )
          explicit = true;
      } catch (e) {
        logger.error("Failed to process the uploaded image", e, {
          userid: req.params.userid,
          type: req.params.type,
        });
        res.status(400).json({
          result: "failed",
          message: "Error occured while uploading",
          error: "Invalid image",
        });
        return;
      }

      // Date.now() alone collides: two uploads in the same millisecond overwrite
      // each other's image.
      const filename = `${Date.now()}-${randomUUID()}.webp`;
      try {
        await uploadToBunny(filename, fileBuffer);
      } catch (e) {
        logger.error("Failed to upload the image to BunnyCDN", e, {
          userid: req.params.userid,
          type: req.params.type,
          filename,
        });
        res.status(502).json({
          result: "failed",
          message: "Error occured while uploading",
          error: "Storage upload failed",
        });
        return;
      }

      const publicUrl = bunnyPublicUrl(filename);

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
          value: publicUrl,
          secret: config.project.secretKey,
        }),
      })
        .then((res) => res.json())
        .then((json: { result?: unknown; message?: unknown }) => {
          if (json.result == "failed") {
            discardUpload(filename, {
              userid: req.params.userid,
              type: req.params.type,
            });
            logger.error("Profile update API error", null, {
              message: json.message,
              userid: req.params.userid,
            });
            res.status(400).json({
              result: "failed",
              message: "Error occured while uploading",
              error: json.message,
            });
            return;
          }

          if (oldFileUrl) {
            // Delete the old file without blocking the response.
            (async () => {
              const oldFilename = oldStorageFile(oldFileUrl);
              if (!oldFilename) {
                logger.info(
                  `Kept the previous ${type} image, which we did not upload`,
                  { userid: req.params.userid, oldFileUrl },
                );
                return;
              }
              try {
                await deleteFromBunny(oldFilename);
                logger.info(`Deleted old ${type} file`, {
                  userid: req.params.userid,
                  oldFilename,
                });
              } catch (err) {
                logger.warn(`Failed to delete old ${type} file`, {
                  userid: req.params.userid,
                  oldFileUrl,
                  error: err,
                });
              }
            })();
          }

          res.status(200).json({ result: "success", url: publicUrl, explicit });
        })
        .catch((err) => {
          discardUpload(filename, {
            userid: req.params.userid,
            type: req.params.type,
          });
          logger.error("Profile update fetch error", err, {
            userid: req.params.userid,
          });
          res.status(500).json({
            result: "failed",
            message: "Error occured while uploading",
            error: "Internal server error",
          });
        });
    });
  },
);
