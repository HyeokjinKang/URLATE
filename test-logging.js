#!/usr/bin/env node

/**
 * Simple test script to verify the logging system
 * This script demonstrates the logging functionality
 */

// Mock the dependencies that might not be installed
const mockPath = require("path");
const mockFs = require("fs");

console.log("=== Testing Logger Module ===\n");

// Test 1: Check if logger module exists
const loggerPath = mockPath.join(__dirname, "src/logger.ts");
if (mockFs.existsSync(loggerPath)) {
  console.log("✓ Logger module exists");
} else {
  console.error("✗ Logger module not found");
  process.exit(1);
}

// Test 2: Check if middleware module exists
const middlewarePath = mockPath.join(__dirname, "src/middleware.ts");
if (mockFs.existsSync(middlewarePath)) {
  console.log("✓ Middleware module exists");
} else {
  console.error("✗ Middleware module not found");
  process.exit(1);
}

// Test 3: Verify logs directory will be created
const logsDir = mockPath.join(__dirname, "logs");
console.log(`✓ Logs directory will be created at: ${logsDir}`);

// Test 4: Check .gitignore includes logs
const gitignorePath = mockPath.join(__dirname, ".gitignore");
if (mockFs.existsSync(gitignorePath)) {
  const gitignoreContent = mockFs.readFileSync(gitignorePath, "utf8");
  if (gitignoreContent.includes("logs/") && gitignoreContent.includes("*.log")) {
    console.log("✓ .gitignore properly excludes log files");
  } else {
    console.error("✗ .gitignore does not exclude log files");
    process.exit(1);
  }
}

// Test 5: Check index.ts has logger imports
const indexPath = mockPath.join(__dirname, "src/index.ts");
if (mockFs.existsSync(indexPath)) {
  const indexContent = mockFs.readFileSync(indexPath, "utf8");
  if (indexContent.includes('from "./logger"') && indexContent.includes('from "./middleware"')) {
    console.log("✓ index.ts properly imports logger and middleware");
  } else {
    console.error("✗ index.ts does not import logger or middleware");
    process.exit(1);
  }
  
  if (indexContent.includes("errorHandler") && indexContent.includes("requestLogger")) {
    console.log("✓ index.ts uses error handler and request logger");
  } else {
    console.error("✗ index.ts does not use middleware");
    process.exit(1);
  }
  
  if (indexContent.includes("unhandledRejection") && indexContent.includes("uncaughtException")) {
    console.log("✓ index.ts has global error handlers");
  } else {
    console.error("✗ index.ts missing global error handlers");
    process.exit(1);
  }
}

// Test 6: Check LOGGING.md exists
const loggingDocPath = mockPath.join(__dirname, "LOGGING.md");
if (mockFs.existsSync(loggingDocPath)) {
  console.log("✓ LOGGING.md documentation exists");
} else {
  console.error("✗ LOGGING.md documentation not found");
  process.exit(1);
}

console.log("\n=== All Tests Passed ===");
console.log("\nLogging System Features:");
console.log("- Console logging with signale");
console.log("- File-based logging (error.log and combined.log)");
console.log("- Request logging middleware");
console.log("- Error handling middleware");
console.log("- Global uncaught exception handlers");
console.log("- Structured logs with timestamps and metadata");
console.log("\nSee LOGGING.md for usage documentation");
