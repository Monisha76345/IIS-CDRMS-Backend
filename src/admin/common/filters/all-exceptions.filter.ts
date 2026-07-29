import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { mapDriverErrorToHttp } from '../utils/service-error';

/**
 * Project-wide API error body:
 * { success: false, message: string, statusCode: number }
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let httpError: HttpException | null =
      exception instanceof HttpException ? exception : null;

    if (!httpError) {
      httpError = mapDriverErrorToHttp(exception);
    }

    if (httpError) {
      const statusCode = httpError.getStatus();
      const payload = httpError.getResponse();
      const raw =
        typeof payload === 'string'
          ? payload
          : (payload as { message?: string | string[] })?.message ??
            httpError.message;
      const message = Array.isArray(raw)
        ? raw.filter(Boolean).join(', ')
        : String(raw);

      return response.status(statusCode).json({
        success: false,
        message,
        statusCode,
      });
    }

    this.logger.error(exception);
    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Internal server error',
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  }
}

/** Clear first validation message for DTO / pipe failures. */
export function validationExceptionFactory(errors: unknown[]) {
  const messages = flattenValidationMessages(errors);
  const message =
    messages[0] || 'Validation failed. Please check your input.';
  return new BadRequestException(message);
}

function flattenValidationMessages(errors: unknown[]): string[] {
  const out: string[] = [];
  for (const err of errors as Array<{
    constraints?: Record<string, string>;
    children?: unknown[];
  }>) {
    if (err?.constraints) {
      out.push(...Object.values(err.constraints));
    }
    if (err?.children?.length) {
      out.push(...flattenValidationMessages(err.children));
    }
  }
  return out;
}
