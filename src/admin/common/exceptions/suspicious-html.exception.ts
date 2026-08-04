import { HttpException, HttpStatus } from '@nestjs/common';

export const SUSPICIOUS_HTML_CODE = 'SUSPICIOUS_HTML';
export const SUSPICIOUS_HTML_ERROR = 'Suspicious Input';

/** Thrown when request body/query contains HTML/script where plain text is expected. */
export class SuspiciousHtmlException extends HttpException {
  constructor(fieldPath: string) {
    super(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        error: SUSPICIOUS_HTML_ERROR,
        code: SUSPICIOUS_HTML_CODE,
        field: fieldPath,
        message: `HTML or script tags are not allowed (field: ${fieldPath})`,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export function isSuspiciousHtmlError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as {
    getResponse?: () => unknown;
    response?: unknown;
  };
  const response =
    typeof e.getResponse === 'function' ? e.getResponse() : e.response;
  if (!response || typeof response !== 'object') return false;
  const body = response as { code?: string; error?: string };
  return (
    body.code === SUSPICIOUS_HTML_CODE || body.error === SUSPICIOUS_HTML_ERROR
  );
}
