# Example Log Output

This file demonstrates what the log files would contain when the logging system is running.

## logs/combined.log

Example of all logs including info, success, warnings, and errors:

```
[2024-10-04T13:00:00.123Z] [INFO] URLATE-v3l-frontend is running on version 1.0.0-beta.2.
[2024-10-04T13:00:00.124Z] [SUCCESS] HTTP Server running at port 3000.
[2024-10-04T13:00:15.456Z] [INFO] GET / - 200 - 45ms
[2024-10-04T13:00:20.789Z] [INFO] GET /game - 200 - 120ms
[2024-10-04T13:01:30.234Z] [WARN] GET /nonexistent - 404 - 5ms
{
  "method": "GET",
  "path": "/nonexistent",
  "statusCode": 404,
  "duration": 5,
  "ip": "::1"
}
[2024-10-04T13:02:45.678Z] [WARN] Invalid file upload attempt
{
  "userid": "12345",
  "type": "picture",
  "mimetype": "application/pdf"
}
[2024-10-04T13:05:12.345Z] [ERROR] File upload error
{
  "userid": "67890",
  "type": "background",
  "error": "File too large"
}
[2024-10-04T13:10:30.567Z] [ERROR] Profile update fetch error
{
  "userid": "12345",
  "error": {
    "message": "Network error",
    "stack": "Error: Network error\n    at fetch...",
    "name": "FetchError"
  }
}
```

## logs/error.log

Example of error-only logs (subset of combined.log):

```
[2024-10-04T13:05:12.345Z] [ERROR] File upload error
{
  "userid": "67890",
  "type": "background",
  "error": "File too large"
}
[2024-10-04T13:10:30.567Z] [ERROR] Profile update fetch error
{
  "userid": "12345",
  "error": {
    "message": "Network error",
    "stack": "Error: Network error\n    at fetch (node:internal/modules/cjs/loader:1373:14)\n    at ...",
    "name": "FetchError"
  }
}
[2024-10-04T13:15:45.890Z] [ERROR] Path traversal attempt detected
{
  "userid": "99999",
  "filePath": "/home/user/../../../etc/passwd",
  "ROOT": "/app/public/images/profiles"
}
[2024-10-04T13:20:00.123Z] [FATAL] Uncaught Exception
{
  "error": {
    "message": "Cannot read property 'foo' of undefined",
    "stack": "TypeError: Cannot read property 'foo' of undefined\n    at Object.<anonymous> (/app/dist/index.js:123:45)\n    at ...",
    "name": "TypeError"
  }
}
[2024-10-04T13:25:15.456Z] [FATAL] Unhandled Promise Rejection
{
  "promise": "[object Promise]",
  "error": {
    "message": "Database connection failed",
    "stack": "Error: Database connection failed\n    at ...",
    "name": "Error"
  }
}
```

## Request Logging Examples

The system automatically logs all HTTP requests with:
- HTTP method
- Path
- Status code
- Response time in milliseconds
- Additional metadata for errors (4xx and 5xx responses)

**Successful request:**
```
[2024-10-04T13:00:15.456Z] [INFO] GET / - 200 - 45ms
```

**Client error (4xx):**
```
[2024-10-04T13:01:30.234Z] [WARN] GET /nonexistent - 404 - 5ms
{
  "method": "GET",
  "path": "/nonexistent",
  "statusCode": 404,
  "duration": 5,
  "ip": "::1"
}
```

**Server error (5xx) - handled by errorHandler middleware:**
```
[2024-10-04T13:30:45.678Z] [ERROR] Request error occurred
{
  "method": "POST",
  "url": "/profile/12345/picture",
  "path": "/profile/12345/picture",
  "query": {},
  "params": {
    "userid": "12345",
    "type": "picture"
  },
  "ip": "::1",
  "userAgent": "Mozilla/5.0 ...",
  "error": {
    "message": "Internal server error",
    "stack": "Error: Internal server error\n    at ...",
    "name": "Error"
  }
}
```

## Log File Structure

- **Timestamp**: ISO 8601 format for easy parsing and sorting
- **Log Level**: INFO, SUCCESS, WARN, ERROR, FATAL, DEBUG
- **Message**: Human-readable description
- **Metadata**: JSON object with contextual information
  - Request details (method, path, query, params)
  - Error information (message, stack trace, name)
  - User context (userid, ip address)
  - Custom data relevant to the operation

## Benefits

1. **Debugging**: Complete stack traces and context for errors
2. **Monitoring**: Request timing and status codes
3. **Security**: Logs of suspicious activity (path traversal, invalid uploads)
4. **Audit Trail**: Chronological record of all operations
5. **Performance**: Response time tracking for all requests
