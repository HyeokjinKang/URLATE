import signale from "signale";
import cookieParser from "cookie-parser";
import express from "express";
import i18n from "./i18n";

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
    ver: process.env.npm_package_version,
    community: config.project.community,
    mirai: config.project.mirai,
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
  res.render("join", { api: config.project.api, ver: process.env.npm_package_version, url: config.project.url });
});

app.get("/game", async (req, res) => {
  res.render("game", {
    cdn: config.project.cdn,
    url: config.project.url,
    api: config.project.api,
    ver: process.env.npm_package_version,
  });
});

app.get("/editor", async (req, res) => {
  res.render("editor", {
    cdn: config.project.cdn,
    url: config.project.url,
    api: config.project.api,
    ver: process.env.npm_package_version,
  });
});

app.get("/test", async (req, res) => {
  res.render("test", {
    cdn: config.project.cdn,
    url: config.project.url,
    api: config.project.api,
    ver: process.env.npm_package_version,
  });
});

app.get("/play", async (req, res) => {
  res.render("play", {
    cdn: config.project.cdn,
    url: config.project.url,
    api: config.project.api,
    ver: process.env.npm_package_version,
  });
});

app.get("/tutorial", async (req, res) => {
  res.render("tutorial", {
    cdn: config.project.cdn,
    url: config.project.url,
    api: config.project.api,
    ver: process.env.npm_package_version,
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

app.listen(config.project.port, () => {
  signale.info(`URLATE-v3l-frontend is running on version ${process.env.npm_package_version}.`);
  signale.success(`HTTP Server running at port ${config.project.port}.`);
});
