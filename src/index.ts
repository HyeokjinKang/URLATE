import signale from "signale";
import cookieParser from "cookie-parser";
import express from "express";
import i18n from "./i18n";
import multer from "multer";
import path from "path";
import fetch from "node-fetch";
const { exec } = require("child_process");

let branch;
exec("git branch --show-current", (err, stdout, stderr) => {
  if (err) {
    return (branch = "production");
  }
  return (branch = stdout.trim());
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const config = require(__dirname + "/../config/config.json");

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
      cb(null, Date.now() + path.extname(file.originalname));
    },
  }),
  limits: {
    fileSize: 1024 * 1024,
  },
}).single("img");

app.post("/profile/:userid/:type", async (req, res) => {
  let type = "";
  if (req.params.type == "picture") type = "picture";
  else if (req.params.type == "background") type = "background";
  else {
    res.status(400).json({
      result: "failed",
      message: "Error occured while uploading",
      error: "Invalid type",
    });
    return;
  }
  upload(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) err = err.message;
      else err.code;
      res.status(400).json({
        result: "failed",
        message: "Error occured while uploading",
        error: err,
      });
      return;
    }
    const file = req.file;
    if (!file || file.mimetype.indexOf("image") == -1) {
      res.status(400).json({
        result: "failed",
        message: "Error occured while uploading",
        error: "Invalid file type",
      });
      return;
    }
    fetch(`${config.project.api}/profile/${type}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userid: req.params.userid,
        value: `${config.project.url}/images/profiles/${file.filename}`,
        secret: config.project.secretKey,
      }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (json.result == "failed") {
          res.status(400).json({
            result: "failed",
            message: "Error occured while uploading",
            error: json.message,
          });
          return;
        }
        res.status(200).json({ result: "success", url: `${config.project.url}/images/profiles/${file.filename}` });
      });
  });
});

app.listen(config.project.port, () => {
  signale.info(`URLATE-v3l-frontend is running on version ${config.project.mode == "test" ? Date.now() : process.env.npm_package_version}.`);
  signale.success(`HTTP Server running at port ${config.project.port}.`);
});
