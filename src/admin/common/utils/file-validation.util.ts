import { HttpException, HttpStatus } from '@nestjs/common';
import * as path from 'path';

export const SAFE_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export const SAFE_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ...SAFE_IMAGE_MIME_TYPES,
]);

const SAFE_IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
]);
const SAFE_DOCUMENT_EXTENSIONS = new Set([
  ...SAFE_IMAGE_EXTENSIONS,
  '.pdf',
  '.doc',
  '.docx',
]);

const DANGEROUS_EXTENSIONS = new Set([
  '.exe',
  '.js',
  '.mjs',
  '.cjs',
  '.php',
  '.bat',
  '.cmd',
  '.sh',
  '.ps1',
  '.dll',
  '.com',
  '.msi',
  '.vbs',
  '.jar',
  '.html',
  '.htm',
  '.svg',
]);

export type FileValidationKind = 'image' | 'document';

export interface FileValidationOptions {
  kind: FileValidationKind;
  maxSizeBytes?: number;
}

export function assertSafeUpload(
  file: Express.Multer.File | undefined | null,
  options: FileValidationOptions,
): void {
  if (!file) {
    throw new HttpException('File is required.', HttpStatus.BAD_REQUEST);
  }

  const maxSize = options.maxSizeBytes ?? 25 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new HttpException(
      `File size exceeds ${(maxSize / (1024 * 1024)).toFixed(0)}MB limit.`,
      HttpStatus.BAD_REQUEST,
    );
  }

  const ext = path.extname(file.originalname || '').toLowerCase();
  if (!ext) {
    throw new HttpException(
      'File must have a valid extension.',
      HttpStatus.BAD_REQUEST,
    );
  }

  if (DANGEROUS_EXTENSIONS.has(ext)) {
    throw new HttpException(
      `File type "${ext}" is not allowed.`,
      HttpStatus.BAD_REQUEST,
    );
  }

  const extensions =
    options.kind === 'image' ? SAFE_IMAGE_EXTENSIONS : SAFE_DOCUMENT_EXTENSIONS;
  const mimes =
    options.kind === 'image' ? SAFE_IMAGE_MIME_TYPES : SAFE_DOCUMENT_MIME_TYPES;

  if (!extensions.has(ext)) {
    throw new HttpException(
      `File extension "${ext}" is not allowed for ${options.kind} uploads.`,
      HttpStatus.BAD_REQUEST,
    );
  }

  const mime = (file.mimetype || '').toLowerCase().trim();
  if (!mime || !mimes.has(mime)) {
    throw new HttpException(
      `File MIME type "${mime || 'unknown'}" is not allowed for ${options.kind} uploads.`,
      HttpStatus.BAD_REQUEST,
    );
  }
}
