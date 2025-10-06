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

  // Send error response
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || "Internal Server Error";

  res.status(statusCode).json({
    result: "failed",
    message: message,
    error: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });
}
