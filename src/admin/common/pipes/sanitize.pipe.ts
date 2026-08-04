import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import { assertNoForbiddenHtml } from '../utils/sanitize.util';

/**
 * Global pipe: rejects body/query values that contain HTML/script tags (400).
 * Suspicious attempts are audited as SECURITY_REJECT by AuditLogInterceptor.
 */
@Injectable()
export class SanitizePipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (metadata.type !== 'body' && metadata.type !== 'query') {
      return value;
    }
    if (value == null) {
      return value;
    }
    assertNoForbiddenHtml(value);
    return value;
  }
}
