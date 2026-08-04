import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { Request, Response } from 'express';
import { AuditService } from './audit.service';
import { isSuspiciousHtmlError } from '../admin/common/exceptions/suspicious-html.exception';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const SENSITIVE_KEYS = new Set([
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

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value == null) return value;
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((v) => redact(v, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEYS.has(k) ? '[REDACTED]' : redact(v, depth + 1);
    }
    return out;
  }
  if (typeof value === 'string' && value.length > 500) {
    return `${value.slice(0, 500)}…`;
  }
  return value;
}

function moduleFromPath(urlPath: string): string {
  const parts = urlPath.split('/').filter(Boolean);
  // e.g. api/v1/admin/auth/login -> admin
  const apiIdx = parts.findIndex((p) => p === 'api');
  if (apiIdx >= 0 && parts[apiIdx + 2]) {
    return parts[apiIdx + 2];
  }
  return parts[0] || 'unknown';
}

function actionFromMethod(method: string): string {
  switch (method.toUpperCase()) {
    case 'POST':
      return 'CREATE';
    case 'PUT':
    case 'PATCH':
      return 'UPDATE';
    case 'DELETE':
      return 'DELETE';
    default:
      return 'OTHER';
  }
}

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request & { user?: Record<string, unknown> }>();
    const res = http.getResponse<Response>();

    const method = (req.method || 'GET').toUpperCase();
    if (!MUTATING_METHODS.has(method)) {
      return next.handle();
    }

    const path = (req.originalUrl || req.url || '').split('?')[0];
    const module = moduleFromPath(path);
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      null;
    const userAgent = (req.headers['user-agent'] as string) || null;
    const bodySnapshot = redact(req.body) as Record<string, unknown> | null;

    const user = req.user || {};
    const userId =
      (user['sub'] as string) ||
      (user['userId'] as string) ||
      (user['id'] as string) ||
      null;
    const username =
      (user['username'] as string) ||
      (user['email'] as string) ||
      (user['loginId'] as string) ||
      null;

    return next.handle().pipe(
      tap(() => {
        void this.auditService.log({
          userId,
          username,
          module,
          action: actionFromMethod(method),
          method,
          path,
          statusCode: res.statusCode,
          ipAddress: ip,
          userAgent,
          newValue: bodySnapshot,
        });
      }),
      catchError((err) => {
        if (isSuspiciousHtmlError(err)) {
          void this.auditService.log({
            userId,
            username,
            module,
            action: 'SECURITY_REJECT',
            method,
            path,
            statusCode: 400,
            ipAddress: ip,
            userAgent,
            newValue: bodySnapshot,
          });
        }
        return throwError(() => err);
      }),
    );
  }
}
