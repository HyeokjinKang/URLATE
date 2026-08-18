import { Request, Response, NextFunction } from "express";
import { logger } from "./logger";

/**
 * Uses the translation function the i18n middleware installs. Error handling can
 * run before that middleware, so fall back to the English text when it is absent.
 */
const translate = (res: Response, key: string, fallback: string): string => {
  const __ = res.locals.__;
  if (typeof __ !== "function") return fallback;
  const translated = __(key);
  // i18n returns an undefined key unchanged.
  return translated === key ? fallback : translated;
};

/**
 * 안내·오류 화면(info·privacy·error)용 정책입니다. 세 화면은 스크립트를 하나도
 * 부르지 않아 script-src를 통째로 막을 수 있고, 그래서 nonce도 필요 없습니다.
 * 나중에 누군가 인라인 스크립트를 넣으면 조용히 동작하는 대신 바로 막히므로,
 * 이 화면들이 정적이라는 전제가 깨지는 순간 드러납니다.
 *
 * default-src를 'none'으로 두고 실제로 쓰는 것만 하나씩 엽니다. 인라인 style
 * 속성도 없어 style-src에 unsafe-inline을 넣지 않았습니다. 예외는 connect-src
 * 하나로, 화면이 아니라 개발자 도구가 쓰는 소스맵 때문입니다(아래 참고).
 *
 * 오류 화면과 같은 정책을 쓰기 때문에 여기에 둡니다. index에서 정의해 가져가면
 * 순환 참조가 됩니다.
 */
const STATIC_PAGE_CSP = [
  "default-src 'none'",
  "script-src 'none'",
  "style-src 'self' https://fonts.googleapis.com https://cdn.jsdelivr.net",
  "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net",
  // 화면이 직접 보내는 요청은 없지만, 개발자 도구를 열면 폰트 CSS의 소스맵
  // (jsdelivr /sm/*.map)을 받아옵니다. 사용자 동작에는 영향이 없어도 막아두면
  // 콘솔에 위반이 쌓여 진짜 문제를 가립니다. style-src·font-src로 이미 신뢰하는
  // 출처라 늘어나는 권한은 없고, 'self'는 쓰지 않으므로 열지 않습니다.
  "connect-src https://cdn.jsdelivr.net",
  // 파비콘과 안내 화면의 아이콘뿐이고 전부 이 서버에서 옵니다.
  "img-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'self'",
].join("; ");

export const setStaticPageCsp = (res: Response): void => {
  res.setHeader("Content-Security-Policy", STATIC_PAGE_CSP);
};

const MESSAGES: Record<number, { key: string; title: string; description: string }> = {
  404: {
    key: "error_404",
    title: "Page not found",
    description: "The page you are looking for does not exist.",
  },
  429: {
    key: "error_429",
    title: "Too many requests",
    description: "Requests came in faster than we allow. Please wait a moment and try again.",
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
 * Send the error response for a status code.
 *
 * Browser navigations get a page, everything else gets JSON: this server serves
 * both pages and the upload API, so neither format can be the only one.
 */
export const sendError = (req: Request, res: Response, status: number): void => {
  const message = MESSAGES[status] ?? MESSAGES[500];
  const title = translate(res, `${message.key}_title`, message.title);
  const description = translate(res, `${message.key}_desc`, message.description);

  res.status(status);
  // req.accepts honours the order of the Accept header. fetch/XHR usually asks
  // for JSON first, so they get JSON instead of the page.
  if (req.accepts(["html", "json"]) === "html") {
    // 어느 경로에서 왔든 오류 화면 자체는 정적입니다. 원래 경로에 걸려 있던
    // 넉넉한 정책을 그대로 물려받지 않도록 여기서 다시 지정합니다.
    setStaticPageCsp(res);
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
        // If even the view fails, send the barest response we can.
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

// Unknown path. Must sit after the routes and before errorHandler.
export function notFoundHandler(req: Request, res: Response): void {
  sendError(req, res, 404);
}

/**
 * Express error handling middleware
 * Logs errors and sends appropriate responses
 */
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  logger.error("Request error occurred", err, {
    method: req.method,
    url: req.url,
    path: req.path,
    query: req.query,
    params: req.params,
    ip: req.ip,
    userAgent: req.get("user-agent"),
  });

  // Once the headers are out nothing can be added; dropping the connection is right.
  if (res.headersSent) return next(err);

  // The stack never goes into a response: it carries absolute paths and dependency
  // versions, and the pm2 config sets no NODE_ENV, so branching on that would leak
  // it in production too.
  const statusCode = err.statusCode || err.status || 500;
  sendError(req, res, statusCode >= 400 && statusCode < 600 ? statusCode : 500);
}
