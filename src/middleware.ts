import { Request, Response, NextFunction } from "express";
import { logger } from "./logger";

/**
 * Express error handling middleware
 * Logs errors and sends appropriate responses
 */
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  // Log the error with request context
  logger.error("Request error occurred", err, {
    method: req.method,
    url: req.url,
    path: req.path,
    query: req.query,
    params: req.params,
    ip: req.ip,
    userAgent: req.get("user-agent"),
  });

  // Send error response. Never include the stack: it carries absolute paths and
  // dependency versions, and NODE_ENV is not set under pm2, so keying on it
  // meant production leaked them.
  const statusCode = err.statusCode || err.status || 500;

  res.status(statusCode).json({
    result: "failed",
    message: statusCode >= 500 ? "Internal Server Error" : err.message || "Bad Request",
  });
}
