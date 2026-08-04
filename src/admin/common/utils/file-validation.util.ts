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

export const SAFE_VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/3gpp',
  'video/3gpp2',
  'video/x-m4v',
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
const SAFE_VIDEO_EXTENSIONS = new Set([
  '.mp4',
  '.mov',
  '.webm',
  '.m4v',
  '.3gp',
  '.3gpp',
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

export type FileValidationKind = 'image' | 'document' | 'video';

export interface FileValidationOptions {
  kind: FileValidationKind;
  maxSizeBytes?: number;
}

/** Infer upload kind from filename / MIME (mobile videos arrive as refType OTHER). */
export function detectUploadKind(
  file: Express.Multer.File | undefined | null,
): FileValidationKind {
  if (!file) return 'document';
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mime = (file.mimetype || '').toLowerCase().trim();
  if (SAFE_VIDEO_EXTENSIONS.has(ext) || mime.startsWith('video/')) {
    return 'video';
  }
  if (SAFE_IMAGE_EXTENSIONS.has(ext) || mime.startsWith('image/')) {
    return 'image';
  }
  return 'document';
}

function allowedForKind(kind: FileValidationKind): {
  extensions: Set<string>;
  mimes: Set<string>;
  defaultMaxBytes: number;
} {
  if (kind === 'image') {
    return {
      extensions: SAFE_IMAGE_EXTENSIONS,
      mimes: SAFE_IMAGE_MIME_TYPES,
      defaultMaxBytes: 25 * 1024 * 1024,
    };
  }
  if (kind === 'video') {
    return {
      extensions: SAFE_VIDEO_EXTENSIONS,
      mimes: SAFE_VIDEO_MIME_TYPES,
      defaultMaxBytes: 100 * 1024 * 1024,
    };
  }
  return {
    extensions: SAFE_DOCUMENT_EXTENSIONS,
    mimes: SAFE_DOCUMENT_MIME_TYPES,
    defaultMaxBytes: 25 * 1024 * 1024,
  };
}

export function assertSafeUpload(
  file: Express.Multer.File | undefined | null,
  options: FileValidationOptions,
): void {
  if (!file) {
    throw new HttpException('File is required.', HttpStatus.BAD_REQUEST);
  }

  const { extensions, mimes, defaultMaxBytes } = allowedForKind(options.kind);
  const maxSize = options.maxSizeBytes ?? defaultMaxBytes;
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

  if (!extensions.has(ext)) {
    throw new HttpException(
      `File extension "${ext}" is not allowed for ${options.kind} uploads.`,
      HttpStatus.BAD_REQUEST,
    );
  }

  const mime = (file.mimetype || '').toLowerCase().trim();
  if (!mime || !mimes.has(mime)) {
    // Android often sends octet-stream / mpeg for camera .mp4 — allow when ext is safe.
    const mimeOkForVideoExt =
      options.kind === 'video' &&
      SAFE_VIDEO_EXTENSIONS.has(ext) &&
      (mime === 'application/octet-stream' ||
        mime === 'video/mpeg' ||
        mime === 'video/avi' ||
        mime.startsWith('video/'));
    if (!mimeOkForVideoExt) {
      throw new HttpException(
        `File MIME type "${mime || 'unknown'}" is not allowed for ${options.kind} uploads.`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
