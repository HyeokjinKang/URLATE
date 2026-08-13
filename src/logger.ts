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

// 로그 회전 기준입니다. 배포가 logs/를 지우지 않으므로 스스로 정리해야
// 디스크가 찹니다. 파일당 상한 x (원본 + 보관본) 만큼만 남습니다.
const MAX_LOG_BYTES = 10 * 1024 * 1024;
const KEEP_ROTATIONS = 3;

// 매 줄마다 stat을 부르지 않도록 크기를 기억해 둡니다.
const knownSizes = new Map<string, number>();

/**
 * 파일을 .1 로 밀어내고 가장 오래된 보관본을 지웁니다.
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
    // 로그를 남기지 못하는 것이 요청을 실패시켜서는 안 됩니다.
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

// Export singleton instance
export const logger = new Logger();
