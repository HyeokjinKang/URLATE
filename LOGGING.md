# Error Logging System

This document describes the error logging system implemented in URLATE.

## Overview

The logging system provides centralized error and event logging with both console output and file-based persistence.

## Features

1. **Console Logging**: Using `signale` library for colored console output
2. **File Logging**: Persistent logs stored in the `logs/` directory
3. **Request Logging**: Automatic logging of all HTTP requests with timing
4. **Error Handling**: Centralized error handling middleware for Express
5. **Unhandled Error Catching**: Global handlers for uncaught exceptions and unhandled promise rejections

## Log Files

- `logs/error.log` - Contains only error and fatal logs
- `logs/combined.log` - Contains all log levels (info, success, warn, error, fatal, debug)

## Log Levels

- **INFO**: General informational messages
- **SUCCESS**: Successful operations
- **WARN**: Warning messages (e.g., 4xx HTTP responses)
- **ERROR**: Error messages with stack traces
- **FATAL**: Critical errors that may cause application termination
- **DEBUG**: Debugging information

## Usage

### In Code

```typescript
import { logger } from "./logger";

// Info logging
logger.info("Server started");

// Success logging
logger.success("Operation completed");

// Warning logging
logger.warn("Deprecated API used", { api: "/old-endpoint" });

// Error logging
logger.error("Database connection failed", error, { database: "main" });

// Fatal logging
logger.fatal("Critical system error", error);
```

### Automatic Logging

The system automatically logs:
- All HTTP requests (with response status and timing)
- Errors in request handling
- Unhandled promise rejections
- Uncaught exceptions

## Log Format

Each log entry includes:
- ISO 8601 timestamp
- Log level
- Message
- Metadata (when provided)
- Error details (for error logs)

Example:
```
[2024-01-01T12:00:00.000Z] [ERROR] File upload error
{
  "userid": "12345",
  "type": "picture",
  "error": {
    "message": "File too large",
    "stack": "..."
  }
}
```

## Configuration

Log files are stored in the `logs/` directory at the project root. This directory is:
- Created automatically on first run
- Excluded from version control (via `.gitignore`)
- Writable by the application process

## Maintenance

- Log files are append-only and will grow over time
- Consider implementing log rotation for production use
- Monitor disk space usage for the logs directory
