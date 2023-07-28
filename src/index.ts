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

app.get("/acc", (req, res) => {
  res.render("account", { api: config.project.api, url: config.project.url });
});

app.get("/join", (req, res) => {
  res.render("join", { api: config.project.api, url: config.project.url });
});

app.get("/authentication", (req, res) => {
  res.render("authentication", {
    api: config.project.api,
    url: config.project.url,
  });
});

app.get("/authentication/success", (req, res) => {
  res.render("authenticationSuccess", {
    api: config.project.api,
    url: config.project.url,
  });
});

app.get("/authentication/failed", (req, res) => {
  res.render("authenticationFailed", {
    url: config.project.url,
  });
});

app.post("/authentication/failed", (req, res) => {
  res.render("authenticationFailed", {
    url: config.project.url,
  });
});

app.get("/advanced/canceled", (req, res) => {
  res.render("subscriptionCanceled", {
    url: config.project.url,
  });
});

app.get("/authorize", (req, res) => {
  if (req.query.status == "fail") {
    res.render("authorizeFail", {
      url: config.project.url,
      api: config.project.api,
    });
  } else {
    res.render("authorize", {
      url: config.project.url,
      api: config.project.api,
    });
  }
});

app.get("/game", async (req, res) => {
  res.render("game", {
    cdn: config.project.cdn,
    url: config.project.url,
    api: config.project.api,
  });
});

app.get("/editor", async (req, res) => {
  res.render("editor", {
    cdn: config.project.cdn,
    url: config.project.url,
    api: config.project.api,
  });
});

app.get("/test", async (req, res) => {
  res.render("test", {
    cdn: config.project.cdn,
    url: config.project.url,
    api: config.project.api,
  });
});

app.get("/play", async (req, res) => {
  res.render("play", {
    cdn: config.project.cdn,
    url: config.project.url,
    api: config.project.api,
  });
});

app.get("/tutorial", async (req, res) => {
  res.render("tutorial", {
    cdn: config.project.cdn,
    url: config.project.url,
    api: config.project.api,
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

app.get("/storePurchased", (req, res) => {
  res.render("storePurchased", { url: config.project.url });
});

app.get("/storeDenied", (req, res) => {
  if (req.query.error == "undefined") {
    req.query.error = "Payment information verification error";
  }
  res.render("storeDenied", {
    error: req.query.error,
    url: config.project.url,
  });
});

app.listen(config.project.port, () => {
  signale.success(`HTTP Server running at port ${config.project.port}.`);
});
