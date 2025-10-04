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

/**
 * Middleware to log all requests
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  
  res.on("finish", () => {
    const duration = Date.now() - start;
    const logMessage = `${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`;
    
    if (res.statusCode >= 400) {
      logger.warn(logMessage, {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        ip: req.ip,
      });
    } else {
      logger.info(logMessage);
    }
  });
  
  next();
}
