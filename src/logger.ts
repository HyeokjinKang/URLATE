import signale from "signale";
import fs from "fs";
import path from "path";

const logsDir = path.join(__dirname, "../logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const errorLogPath = path.join(logsDir, "error.log");
const combinedLogPath = path.join(logsDir, "combined.log");

// Rotation bounds. A deploy does not clear logs/, so the logs have to trim
// themselves or the disk fills up. At most (limit per file) x (live + kept) remains.
const MAX_LOG_BYTES = 10 * 1024 * 1024;
const KEEP_ROTATIONS = 3;

// Remembered so a stat is not needed for every line written.
const knownSizes = new Map<string, number>();

/**
 * Shift the file down to .1 and drop the oldest kept copy.
 */
function rotate(filePath: string): void {
  const oldest = `${filePath}.${KEEP_ROTATIONS}`;
  if (fs.existsSync(oldest)) fs.unlinkSync(oldest);
  for (let i = KEEP_ROTATIONS - 1; i >= 1; i--) {
    const from = `${filePath}.${i}`;
    if (fs.existsSync(from)) fs.renameSync(from, `${filePath}.${i + 1}`);
  }
  if (fs.existsSync(filePath)) fs.renameSync(filePath, `${filePath}.1`);
}

function formatLogEntry(level: string, message: string, meta?: any): string {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? `\n${JSON.stringify(meta, null, 2)}` : "";
  return `[${timestamp}] [${level}] ${message}${metaStr}\n`;
}

function writeToFile(filePath: string, content: string): void {
  try {
    const bytes = Buffer.byteLength(content, "utf8");
    let size = knownSizes.get(filePath);
    if (size === undefined) {
      size = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
    }
    if (size + bytes > MAX_LOG_BYTES) {
      rotate(filePath);
      size = 0;
    }
    fs.appendFileSync(filePath, content, "utf8");
    knownSizes.set(filePath, size + bytes);
  } catch (err) {
    // Failing to log must never fail the request.
    console.error("Failed to write to log file:", err);
  }
}

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
      error:
        error instanceof Error
          ? {
              message: error.message,
              stack: error.stack,
              name: error.name,
            }
          : error,
    };

    const logEntry = formatLogEntry("ERROR", message, errorMeta);
    writeToFile(errorLogPath, logEntry);
    writeToFile(combinedLogPath, logEntry);
  }

  fatal(message: string, error?: Error | any, meta?: any): void {
    signale.fatal(message);

    const errorMeta = {
      ...meta,
      error:
        error instanceof Error
          ? {
              message: error.message,
              stack: error.stack,
              name: error.name,
            }
          : error,
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

export const logger = new Logger();
