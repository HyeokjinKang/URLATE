import { Request, Response, NextFunction } from "express";
import { logger } from "./logger";

/**
 * Uses the translation function the i18n middleware installs. Error handling can
 * run before that middleware, so fall back to the English text when it is absent.
 */
const translate = (res: Response, key: string, fallback: string): string => {
  const __ = res.locals.__;
  if (typeof __ !== "function") return fallback;
  const translated = __(key);
  // i18n returns an undefined key unchanged.
  return translated === key ? fallback : translated;
};

const MESSAGES: Record<number, { key: string; title: string; description: string }> = {
  404: {
    key: "error_404",
    title: "Page not found",
    description: "The page you are looking for does not exist.",
  },
  503: {
    key: "error_503",
    title: "Service unavailable",
    description: "Something we depend on is not responding. Please try again in a moment.",
  },
  500: {
    key: "error_500",
    title: "Something went wrong",
    description: "An unexpected error occurred. Please try again later.",
  },
};

/**
 * Send the error response for a status code.
 *
 * Browser navigations get a page, everything else gets JSON: this server serves
 * both pages and the upload API, so neither format can be the only one.
 */
export const sendError = (req: Request, res: Response, status: number): void => {
  const message = MESSAGES[status] ?? MESSAGES[500];
  const title = translate(res, `${message.key}_title`, message.title);
  const description = translate(res, `${message.key}_desc`, message.description);

  res.status(status);
  // req.accepts honours the order of the Accept header. fetch/XHR usually asks
  // for JSON first, so they get JSON instead of the page.
  if (req.accepts(["html", "json"]) === "html") {
    res.render(
      "error",
      {
        code: status,
        title,
        description,
        home: translate(res, "error_home", "Back to the main page"),
        locale: res.locals.locale ?? "en",
      },
      (err, html) => {
        // If even the view fails, send the barest response we can.
        if (err) {
          logger.error("Failed to render the error page", err, { status });
          res.type("text").send(`${status} ${title}`);
          return;
        }
        res.send(html);
      },
    );
    return;
  }
  res.json({ result: "failed", message: title, error: description });
};

// Unknown path. Must sit after the routes and before errorHandler.
export function notFoundHandler(req: Request, res: Response): void {
  sendError(req, res, 404);
}

/**
 * Express error handling middleware
 * Logs errors and sends appropriate responses
 */
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  logger.error("Request error occurred", err, {
    method: req.method,
    url: req.url,
    path: req.path,
    query: req.query,
    params: req.params,
    ip: req.ip,
    userAgent: req.get("user-agent"),
  });

  // Once the headers are out nothing can be added; dropping the connection is right.
  if (res.headersSent) return next(err);

  // The stack never goes into a response: it carries absolute paths and dependency
  // versions, and the pm2 config sets no NODE_ENV, so branching on that would leak
  // it in production too.
  const statusCode = err.statusCode || err.status || 500;
  sendError(req, res, statusCode >= 400 && statusCode < 600 ? statusCode : 500);
}
