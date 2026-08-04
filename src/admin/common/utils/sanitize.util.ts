import type { IOptions } from 'sanitize-html';
import { SuspiciousHtmlException } from '../exceptions/suspicious-html.exception';

// sanitize-html is CJS (`module.exports = fn`). Default ESM import breaks under Nest.
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const sanitizeHtml: typeof import('sanitize-html') = require('sanitize-html');

const STRIP_ALL_HTML: IOptions = {
  allowedTags: [],
  allowedAttributes: {},
};

const SKIP_KEYS = new Set([
  'password',
  'newPassword',
  'oldPassword',
  'confirmPassword',
  'currentPassword',
  'accessToken',
  'refreshToken',
  'token',
  'otp',
  'captcha',
  'userInput',
]);

const HTML_META_CHARS = /[<>]/;

export function containsForbiddenHtml(value: unknown): boolean {
  if (typeof value !== 'string' || value.trim() === '') return false;
  if (HTML_META_CHARS.test(value)) return true;
  if (/javascript\s*:/i.test(value)) return true;
  if (/\bon[a-z]+\s*=/i.test(value)) return true;
  if (/<\s*script\b/i.test(value)) return true;
  return false;
}

export function findForbiddenHtmlPath(
  value: unknown,
  path: string[] = [],
  key?: string,
): string | null {
  if (key && SKIP_KEYS.has(key)) {
    return null;
  }

  if (typeof value === 'string') {
    return containsForbiddenHtml(value)
      ? path.length
        ? path.join('.')
        : '(root)'
      : null;
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const found = findForbiddenHtmlPath(value[i], [...path, String(i)]);
      if (found) return found;
    }
    return null;
  }

  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const found = findForbiddenHtmlPath(v, [...path, k], k);
      if (found) return found;
    }
  }

  return null;
}

export function assertNoForbiddenHtml(value: unknown): void {
  const badPath = findForbiddenHtmlPath(value);
  if (badPath) {
    throw new SuspiciousHtmlException(badPath);
  }
}

export function sanitizeInput(value: string): string {
  if (value == null || value === '') return value;
  return sanitizeHtml(value, STRIP_ALL_HTML).trim();
}
