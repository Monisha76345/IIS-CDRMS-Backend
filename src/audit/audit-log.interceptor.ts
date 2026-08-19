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
import { runWithAuditContext } from './audit-context';

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
  const apiIdx = parts.findIndex((p) => p === 'api');
  if (apiIdx >= 0 && parts[apiIdx + 2]) {
    return parts[apiIdx + 2];
  }
  return parts[0] || 'unknown';
}

function parseSemanticAction(
  method: string,
  urlPath: string,
  body?: Record<string, unknown> | null,
): { action: string; title: string; module: string } {
  const m = method.toUpperCase();
  const lowerPath = urlPath.toLowerCase();

  if (lowerPath.includes('/auth/login')) {
    return { action: 'LOGIN', title: 'User logged in', module: 'auth' };
  }
  if (lowerPath.includes('/auth/logout')) {
    return { action: 'LOGOUT', title: 'User logged out', module: 'auth' };
  }
  if (lowerPath.includes('/users/posts') && m === 'POST') {
    const postName = body?.postName ? String(body.postName) : '';
    return {
      action: 'POST_CREATED',
      title: postName ? `New Post Created: ${postName}` : 'New post created',
      module: 'posts',
    };
  }
  if (lowerPath.includes('/users/mappings') && lowerPath.includes('unmap')) {
    return {
      action: 'PERSON_UNMAPPED',
      title: 'Officer unmapped from post',
      module: 'mappings',
    };
  }
  if (lowerPath.includes('/users/mappings') && m === 'POST') {
    return {
      action: 'PERSON_MAPPED',
      title: 'Officer mapped to post',
      module: 'mappings',
    };
  }
  if (lowerPath.includes('/users/people') && m === 'POST') {
    const name =
      body?.firstName || body?.lastName
        ? `${body.firstName || ''} ${body.lastName || ''}`.trim()
        : '';
    return {
      action: 'PERSON_CREATED',
      title: name ? `Created Officer Profile: ${name}` : 'New officer profile created',
      module: 'people',
    };
  }
  if (lowerPath.includes('/users/roles') && m === 'POST') {
    return { action: 'ROLE_CREATED', title: 'New role created', module: 'roles' };
  }
  if (lowerPath.includes('/geo-locations') || lowerPath.includes('/geo/assign')) {
    return { action: 'GEO_ASSIGNED', title: 'Geo assignment updated', module: 'geo' };
  }

  const module = moduleFromPath(urlPath);
  let fallbackAction = 'OTHER';
  if (m === 'POST') fallbackAction = 'CREATE';
  else if (m === 'PUT' || m === 'PATCH') fallbackAction = 'UPDATE';
  else if (m === 'DELETE') fallbackAction = 'DELETE';

  return { action: fallbackAction, title: `${fallbackAction} ${module}`, module };
}

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request & { user?: Record<string, unknown> }>();
    const res = http.getResponse<Response>();

    const method = (req.method || 'GET').toUpperCase();
    const path = (req.originalUrl || req.url || '').split('?')[0];
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      null;
    const userAgent = (req.headers['user-agent'] as string) || null;
    const requestId = (req.headers['x-request-id'] as string) || null;

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

    const ctxData = { userId, username, ipAddress: ip, requestId, userAgent };

    return new Observable((subscriber) => {
      runWithAuditContext(ctxData, () => {
        if (!MUTATING_METHODS.has(method)) {
          const inner$ = next.handle();
          return inner$.subscribe({
            next: (v) => subscriber.next(v),
            error: (e) => subscriber.error(e),
            complete: () => subscriber.complete(),
          });
        }

        const bodySnapshot = redact(req.body) as Record<string, unknown> | null;
        const semantic = parseSemanticAction(method, path, bodySnapshot);

        const inner$ = next.handle().pipe(
          tap(() => {
            void this.auditService.log({
              userId,
              username,
              module: semantic.module,
              action: semantic.action,
              title: semantic.title,
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
                module: semantic.module,
                action: 'SECURITY_REJECT',
                title: 'Security policy rejection',
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

        return inner$.subscribe({
          next: (v) => subscriber.next(v),
          error: (e) => subscriber.error(e),
          complete: () => subscriber.complete(),
        });
      });
    });
  }
}
