import signale from "signale";
import fs from "fs";
import path from "path";

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, "../logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Log file paths
const errorLogPath = path.join(logsDir, "error.log");
const combinedLogPath = path.join(logsDir, "combined.log");

/**
 * Format log entry with timestamp
 */
function formatLogEntry(level: string, message: string, meta?: any): string {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? `\n${JSON.stringify(meta, null, 2)}` : "";
  return `[${timestamp}] [${level}] ${message}${metaStr}\n`;
}

/**
 * Write log to file
 */
function writeToFile(filePath: string, content: string): void {
  try {
    fs.appendFileSync(filePath, content, "utf8");
  } catch (err) {
    console.error("Failed to write to log file:", err);
  }
}

/**
 * Logger class for centralized logging
 */
class Logger {
  info(message: string, meta?: any): void {
    signale.info(message);
    const logEntry = formatLogEntry("INFO", message, meta);
    writeToFile(combinedLogPath, logEntry);
  }

  success(message: string, meta?: any): void {
    signale.success(message);
    const logEntry = formatLogEntry("SUCCESS", message, meta);
    writeToFile(combinedLogPath, logEntry);
  }

  warn(message: string, meta?: any): void {
    signale.warn(message);
    const logEntry = formatLogEntry("WARN", message, meta);
    writeToFile(combinedLogPath, logEntry);
  }

  error(message: string, error?: Error | any, meta?: any): void {
    signale.error(message);
    
    const errorMeta = {
      ...meta,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : error,
    };
    
    const logEntry = formatLogEntry("ERROR", message, errorMeta);
    writeToFile(errorLogPath, logEntry);
    writeToFile(combinedLogPath, logEntry);
  }

  fatal(message: string, error?: Error | any, meta?: any): void {
    signale.fatal(message);
    
    const errorMeta = {
      ...meta,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : error,
    };
    
    const logEntry = formatLogEntry("FATAL", message, errorMeta);
    writeToFile(errorLogPath, logEntry);
    writeToFile(combinedLogPath, logEntry);
  }

  debug(message: string, meta?: any): void {
    signale.debug(message);
    const logEntry = formatLogEntry("DEBUG", message, meta);
    writeToFile(combinedLogPath, logEntry);
  }
}

// Export singleton instance
export const logger = new Logger();
