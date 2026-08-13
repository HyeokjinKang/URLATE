import { Request, Response, NextFunction } from "express";
import { logger } from "./logger";

/**
 * i18n 미들웨어가 심어 둔 번역 함수를 씁니다. 오류 처리는 그 미들웨어보다
 * 앞에서도 불릴 수 있으므로, 없으면 영어 문구로 되돌아갑니다.
 */
const translate = (res: Response, key: string, fallback: string): string => {
  const __ = res.locals.__;
  if (typeof __ !== "function") return fallback;
  const translated = __(key);
  // i18n은 정의되지 않은 키를 그대로 돌려줍니다.
  return translated === key ? fallback : translated;
};

const MESSAGES: Record<number, { key: string; title: string; description: string }> = {
  404: {
    key: "error_404",
    title: "Page not found",
    description: "The page you are looking for does not exist.",
  },
  503: {
    key: "error_503",
    title: "Service unavailable",
    description: "Something we depend on is not responding. Please try again in a moment.",
  },
  500: {
    key: "error_500",
    title: "Something went wrong",
    description: "An unexpected error occurred. Please try again later.",
  },
};

/**
 * 상태 코드에 맞는 오류 응답을 보냅니다.
 *
 * 브라우저 내비게이션에는 화면을, 그 밖에는 JSON을 돌려줍니다. 이 서버는
 * 페이지와 업로드 API를 함께 제공하므로 한쪽 형식으로 고정할 수 없습니다.
 */
export const sendError = (req: Request, res: Response, status: number): void => {
  const message = MESSAGES[status] ?? MESSAGES[500];
  const title = translate(res, `${message.key}_title`, message.title);
  const description = translate(res, `${message.key}_desc`, message.description);

  res.status(status);
  // req.accepts는 Accept 헤더 순서를 존중합니다. fetch/XHR은 보통 JSON을
  // 먼저 요구하므로 화면 대신 JSON을 받게 됩니다.
  if (req.accepts(["html", "json"]) === "html") {
    res.render(
      "error",
      {
        code: status,
        title,
        description,
        home: translate(res, "error_home", "Back to the main page"),
        locale: res.locals.locale ?? "en",
      },
      (err, html) => {
        // 뷰 렌더링까지 실패하면 최소한의 응답이라도 보냅니다.
        if (err) {
          logger.error("Failed to render the error page", err, { status });
          res.type("text").send(`${status} ${title}`);
          return;
        }
        res.send(html);
      },
    );
    return;
  }
  res.json({ result: "failed", message: title, error: description });
};

// 알 수 없는 경로입니다. 라우터 뒤, errorHandler 앞에 두어야 합니다.
export function notFoundHandler(req: Request, res: Response): void {
  sendError(req, res, 404);
}

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

  // 헤더가 이미 나갔으면 응답을 덧붙일 수 없습니다. 연결을 끊는 것이 맞습니다.
  if (res.headersSent) return next(err);

  // 스택은 절대 응답에 싣지 않습니다. 절대 경로와 의존성 버전이 담겨 있고,
  // pm2 설정에 NODE_ENV가 없어 그것으로 분기하면 운영에서도 노출됩니다.
  const statusCode = err.statusCode || err.status || 500;
  sendError(req, res, statusCode >= 400 && statusCode < 600 ? statusCode : 500);
}
