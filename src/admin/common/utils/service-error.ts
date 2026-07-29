import {
  BadRequestException,
  ConflictException,
  HttpException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

function readDriver(error: unknown): {
  code?: string;
  errno?: number;
  message: string;
} {
  const e = error as {
    code?: string;
    errno?: number;
    message?: string;
    sqlMessage?: string;
    driverError?: {
      code?: string;
      errno?: number;
      message?: string;
      sqlMessage?: string;
    };
  };

  return {
    code: e?.code ?? e?.driverError?.code,
    errno: e?.errno ?? e?.driverError?.errno,
    message:
      e?.sqlMessage ||
      e?.driverError?.sqlMessage ||
      e?.message ||
      e?.driverError?.message ||
      '',
  };
}

/** Map known MySQL/driver errors to HttpException. Returns null if unknown. */
export function mapDriverErrorToHttp(error: unknown): HttpException | null {
  const { code, errno, message } = readDriver(error);

  const isDup =
    code === 'ER_DUP_ENTRY' ||
    errno === 1062 ||
    /Duplicate entry/i.test(message);

  if (isDup) {
    if (/@/.test(message) || /\bemail\b/i.test(message)) {
      return new ConflictException('Email is already registered');
    }
    if (/\bphone\b|\bmobile\b/i.test(message) || /'\d{10}'/.test(message)) {
      return new ConflictException('Mobile number is already registered');
    }
    return new ConflictException(
      'A record with the same unique details already exists',
    );
  }

  if (
    code === 'ER_DATA_TOO_LONG' ||
    errno === 1406 ||
    /data too long for column/i.test(message)
  ) {
    if (/phone|mobile/i.test(message)) {
      return new BadRequestException(
        'Mobile/phone number must be exactly 10 digits and start with 6, 7, 8, or 9',
      );
    }
    return new BadRequestException(
      'One or more fields exceed the maximum allowed length. Please check your input.',
    );
  }

  return null;
}

/**
 * Use in service catch blocks:
 * - HttpException (validation / not found / conflict) → rethrow as-is
 * - Known DB errors → clear Conflict/BadRequest message
 * - Else → Internal server error with fallback (schema/script issues)
 */
export function rethrowServiceError(
  error: unknown,
  fallbackMessage: string,
  logger?: Logger,
): never {
  if (error instanceof HttpException) {
    throw error;
  }

  const mapped = mapDriverErrorToHttp(error);
  if (mapped) {
    throw mapped;
  }

  logger?.error(
    fallbackMessage,
    error instanceof Error ? error.stack : undefined,
  );
  throw new InternalServerErrorException(fallbackMessage);
}
