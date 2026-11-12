import { Request } from "express";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const config = require(__dirname + "/../config/config.json");

export const visitorHeaders = (req: Request): Record<string, string> =>
  req.ip
    ? {
        "X-URLATE-Service-Key": config.project.secretKey,
        "X-URLATE-Visitor-IP": req.ip,
      }
    : {};
