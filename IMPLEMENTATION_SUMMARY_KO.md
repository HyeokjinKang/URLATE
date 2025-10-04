# Error Logging System Implementation Summary

## 개요 (Overview)

버그 또는 에러 발생시 로그를 생성하는 시스템을 구현했습니다. 이 시스템은 콘솔 출력과 파일 기반 로깅을 모두 지원하며, Express.js 애플리케이션의 모든 에러와 요청을 자동으로 기록합니다.

An error logging system has been implemented to generate logs when bugs or errors occur. This system supports both console output and file-based logging, automatically recording all errors and requests in the Express.js application.

## 주요 기능 (Key Features)

### 1. 콘솔 및 파일 로깅 (Console and File Logging)
- **콘솔**: signale 라이브러리를 사용한 컬러풀한 출력
- **파일**: 
  - `logs/error.log` - 에러와 치명적 에러만 기록
  - `logs/combined.log` - 모든 로그 레벨 기록

### 2. 자동 요청 로깅 (Automatic Request Logging)
- 모든 HTTP 요청의 자동 기록
- 메소드, 경로, 상태 코드, 응답 시간 포함
- 4xx/5xx 에러는 추가 메타데이터와 함께 경고/에러로 기록

### 3. 중앙 집중식 에러 처리 (Centralized Error Handling)
- Express 에러 핸들링 미들웨어
- 스택 트레이스와 요청 컨텍스트 포함
- 전역 uncaught exception/unhandled rejection 핸들러

### 4. 보안 이벤트 로깅 (Security Event Logging)
- 경로 탐색 시도 감지 및 로깅
- 잘못된 파일 업로드 시도 기록
- API 에러 추적

## 파일 구조 (File Structure)

```
URLATE/
├── src/
│   ├── logger.ts           # 중앙 로거 모듈
│   ├── middleware.ts       # Express 미들웨어
│   └── index.ts            # 로거 통합됨
├── logs/                   # 로그 파일 디렉토리 (자동 생성)
│   ├── error.log          # 에러 로그만
│   └── combined.log       # 모든 로그
├── LOGGING.md             # 사용 문서
├── LOG_EXAMPLES.md        # 로그 예시
└── test-logging.js        # 검증 스크립트
```

## 사용 방법 (Usage)

### 코드에서 로깅 (Logging in Code)

```typescript
import { logger } from "./logger";

// 정보 로그
logger.info("서버가 시작되었습니다");

// 성공 로그
logger.success("작업이 완료되었습니다");

// 경고 로그
logger.warn("잘못된 요청입니다", { userid: "12345" });

// 에러 로그
logger.error("파일 업로드 실패", error, { 
  userid: "12345", 
  type: "picture" 
});

// 치명적 에러 로그
logger.fatal("데이터베이스 연결 실패", error);
```

### 자동 로깅 (Automatic Logging)

시스템이 자동으로 기록하는 항목:
- ✓ 모든 HTTP 요청 (시간, 상태 코드 포함)
- ✓ 요청 처리 중 발생한 에러
- ✓ 처리되지 않은 Promise rejection
- ✓ 처리되지 않은 예외

## 로그 형식 (Log Format)

```
[2024-10-04T13:00:00.123Z] [ERROR] File upload error
{
  "userid": "67890",
  "type": "background",
  "error": {
    "message": "File too large",
    "stack": "Error: File too large\n    at ...",
    "name": "Error"
  }
}
```

각 로그 항목은 다음을 포함합니다:
- ISO 8601 타임스탬프
- 로그 레벨 (INFO, SUCCESS, WARN, ERROR, FATAL, DEBUG)
- 사람이 읽을 수 있는 메시지
- JSON 메타데이터 (선택적)

## 테스트 (Testing)

검증 스크립트 실행:
```bash
node test-logging.js
```

모든 테스트 통과 시 출력:
```
✓ Logger module exists
✓ Middleware module exists
✓ Logs directory will be created
✓ .gitignore properly excludes log files
✓ index.ts properly imports logger and middleware
✓ index.ts uses error handler and request logger
✓ index.ts has global error handlers
✓ LOGGING.md documentation exists
```

## 구현 세부사항 (Implementation Details)

### 수정된 파일 (Modified Files)

1. **src/index.ts**
   - logger와 middleware 모듈 import
   - requestLogger 미들웨어 추가
   - 모든 signale 호출을 logger로 교체
   - 파일 업로드 에러 핸들러에 로깅 추가
   - 전역 에러 핸들러 추가
   - Express 에러 미들웨어 추가

2. **.gitignore**
   - `logs/` 디렉토리 제외
   - `*.log` 파일 제외

### 새 파일 (New Files)

1. **src/logger.ts** - 핵심 로깅 모듈
2. **src/middleware.ts** - Express 미들웨어
3. **LOGGING.md** - 완전한 문서
4. **LOG_EXAMPLES.md** - 실제 예시
5. **test-logging.js** - 검증 스크립트

## 장점 (Benefits)

1. **디버깅**: 완전한 스택 트레이스와 컨텍스트
2. **모니터링**: 요청 타이밍과 상태 코드 추적
3. **보안**: 의심스러운 활동 기록
4. **감사 추적**: 모든 작업의 시간순 기록
5. **성능**: 모든 요청의 응답 시간 추적

## 향후 개선 사항 (Future Improvements)

프로덕션 환경을 위한 고려사항:
- 로그 로테이션 (일별 또는 크기별)
- 로그 집계 서비스 통합
- 성능 메트릭 수집
- 커스텀 로그 레벨 또는 필터링

## 문의 (Questions)

자세한 내용은 다음 문서를 참조하세요:
- **LOGGING.md** - 사용 가이드
- **LOG_EXAMPLES.md** - 로그 출력 예시

---

**구현 날짜**: 2024-10-04  
**버전**: 1.0.0  
**상태**: ✅ 완료 및 테스트 완료
