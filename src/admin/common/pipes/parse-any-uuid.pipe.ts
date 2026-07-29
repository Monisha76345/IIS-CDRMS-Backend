import {
  PipeTransform,
  Injectable,
  BadRequestException,
} from '@nestjs/common';

/** Accepts UUID v1 (MySQL UUID()) and v4 (TypeORM), etc. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class ParseAnyUuidPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    const id = String(value ?? '').trim();
    if (!UUID_RE.test(id)) {
      throw new BadRequestException(
        `Validation failed (uuid is expected) for value "${value}"`,
      );
    }
    return id;
  }
}
