import cookieParser from "cookie-parser";
import express from "express";
import i18n from "./i18n";
import multer from "multer";
import path from "path";
import fetch from "node-fetch";
import * as nsfw from "nsfwjs";
import { exec } from "child_process";
import * as tf from "@tensorflow/tfjs-node";
import fs from "fs";
import sharp from "sharp";
import { logger } from "./logger";
import { errorHandler } from "./middleware";

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

const app = express();
app.locals.pretty = true;

app.set("view engine", "ejs");
app.set("views", __dirname + "/../views");
app.use(cookieParser());
app.use(express.static(__dirname + "/../public"));
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

app.get("/game", async (req, res) => {
  res.render("game", {
    cdn: config.project.cdn,
    url: config.project.url,
    api: config.project.api,
    game: config.project.game,
    ver: config.project.mode == "test" ? Date.now() : process.env.npm_package_version,
  });
});

app.get("/editor", async (req, res) => {
  res.render("editor", {
    cdn: config.project.cdn,
    url: config.project.url,
    api: config.project.api,
    game: config.project.game,
    ver: config.project.mode == "test" ? Date.now() : process.env.npm_package_version,
  });
});

app.get("/test", async (req, res) => {
  res.render("test", {
    cdn: config.project.cdn,
    url: config.project.url,
    api: config.project.api,
    game: config.project.game,
    ver: config.project.mode == "test" ? Date.now() : process.env.npm_package_version,
  });
});

app.get("/play", async (req, res) => {
  res.render("play", {
    cdn: config.project.cdn,
    url: config.project.url,
    api: config.project.api,
    game: config.project.game,
    ver: config.project.mode == "test" ? Date.now() : process.env.npm_package_version,
  });
});

app.get("/tutorial", async (req, res) => {
  res.render("tutorial", {
    cdn: config.project.cdn,
    url: config.project.url,
    api: config.project.api,
    game: config.project.game,
    ver: config.project.mode == "test" ? Date.now() : process.env.npm_package_version,
  });
});

app.get("/accessDenined", (req, res) => {
  res.render("accessDenined");
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
      cb(null, __dirname + "/../public/images/profiles");
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + ".webp");
    },
  }),
  limits: {
    fileSize: 1024 * 1024 * 3,
  },
}).single("img");

app.post("/profile/:userid/:type", async (req, res) => {
  // Validate userid: must be alphanumeric plus underscores/hyphens, 3-64 chars (example)
  if (!/^[0-9]*$/.test(req.params.userid)) {
    res.status(400).json({
      result: "failed",
      message: "Invalid userid format",
      error: "Bad userid"
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
    });
    const profileData: any = await profileResponse.json();
    if (profileData.result === "success" && profileData.user[type] && !profileData.user[type].includes("cdn.urlate.coupy.dev") && !profileData.user[type].includes("googleusercontent")) {
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
      .webp({
        quality: 70,
        effort: 6,
      })
      .toBuffer();
    fs.writeFileSync(filePath, fileBuffer);
    const buffer = await sharp(fileBuffer).png().toBuffer();
    const image = tf.node.decodeImage(buffer, 3);
    const predictions = await model.classify(image);
    image.dispose();
    let explicit = false;
    if (predictions[0].className != "Drawing" && predictions[0].className != "Neutral") explicit = true;
    fetch(`${config.project.api}/profile/${type}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        explicit,
        userid: req.params.userid,
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
          try {
            // Extract filename from URL
            const urlParts = oldFileUrl.split("/");
            const oldFilename = urlParts[urlParts.length - 1];
            const oldFilePath = path.join(__dirname, "../public/images/profiles", oldFilename);

            // Verify the path is within the profiles directory and file exists
            const ROOT = path.join(__dirname, "../public/images/profiles");
            if (fs.existsSync(oldFilePath)) {
              const resolvedPath = fs.realpathSync(oldFilePath);
              if (resolvedPath.startsWith(ROOT)) {
                fs.unlinkSync(resolvedPath);
                logger.info(`Deleted old ${type} file`, { userid: req.params.userid, type, oldFilename });
              }
            }
          } catch (err) {
            // Log but don't fail the request if old file deletion fails
            logger.warn(`Failed to delete old ${type} file`, { userid: req.params.userid, type, oldFileUrl, error: err });
          }
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

loadModel()
  .then(() => {
    app.listen(config.project.port, () => {
      logger.info(`URLATE-v3l-frontend is running on version ${config.project.mode == "test" ? Date.now() : process.env.npm_package_version}.`);
      logger.success(`HTTP Server running at port ${config.project.port}.`);
    });
  })
  .catch((err) => {
    logger.fatal("Failed to load NSFW model", err);
    process.exit(1);
  });

// Add error handler middleware (must be last)
app.use(errorHandler);

