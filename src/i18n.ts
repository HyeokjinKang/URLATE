import path from "path";
import i18n from "i18n";
import { NextFunction, Request, Response } from "express";

i18n.configure({
  locales: ["ko", "en"],
  directory: path.join(__dirname, "..", "locales"),
  defaultLocale: "en",
  cookie: "lang",
});

export default (req: Request, res: Response, next: NextFunction) => {
  i18n.init(req, res);
  res.locals.__ = res.__;
  next();
};
