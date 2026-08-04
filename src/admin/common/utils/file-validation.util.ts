import { HttpException, HttpStatus } from '@nestjs/common';
import * as path from 'path';

export const SAFE_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export const SAFE_VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/3gpp',
  'video/3gpp2',
  'video/x-m4v',
  'video/mpeg',
  'video/avi',
  'video/x-msvideo',
]);

export const SAFE_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ...SAFE_IMAGE_MIME_TYPES,
  // Mobile inspection videos historically upload as entityType DOCUMENT —
  // allow video MIME on the document path too.
  ...SAFE_VIDEO_MIME_TYPES,
  'application/octet-stream',
]);

const SAFE_IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
]);

const SAFE_VIDEO_EXTENSIONS = new Set([
  '.mp4',
  '.mov',
  '.webm',
  '.m4v',
  '.3gp',
  '.3gpp',
]);

const SAFE_DOCUMENT_EXTENSIONS = new Set([
  ...SAFE_IMAGE_EXTENSIONS,
  ...SAFE_VIDEO_EXTENSIONS,
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

export type FileValidationKind = 'image' | 'document' | 'video';

export interface FileValidationOptions {
  kind: FileValidationKind;
  maxSizeBytes?: number;
}

function isVideoSignal(ext: string, mime: string): boolean {
  return (
    SAFE_VIDEO_EXTENSIONS.has(ext) ||
    mime.startsWith('video/') ||
    mime === 'application/octet-stream'
  );
}

/**
 * Infer upload kind from filename / MIME / optional client hint.
 * Mobile videos often arrive as entityType DOCUMENT + refType OTHER.
 */
export function detectUploadKind(
  file: Express.Multer.File | undefined | null,
  mediaKindHint?: string | null,
): FileValidationKind {
  const hint = (mediaKindHint || '').toLowerCase().trim();
  if (hint === 'video' || hint === 'image' || hint === 'document') {
    return hint;
  }
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
      mimes: new Set([
        ...SAFE_VIDEO_MIME_TYPES,
        'application/octet-stream',
      ]),
      defaultMaxBytes: 100 * 1024 * 1024,
    };
  }
  return {
    extensions: SAFE_DOCUMENT_EXTENSIONS,
    mimes: SAFE_DOCUMENT_MIME_TYPES,
    defaultMaxBytes: 100 * 1024 * 1024,
  };
}

/** Ensure multer file has a usable extension when Android omits one. */
export function normalizeUploadFileName(
  file: Express.Multer.File,
): Express.Multer.File {
  const current = file.originalname || '';
  let ext = path.extname(current).toLowerCase();
  const mime = (file.mimetype || '').toLowerCase().trim();

  if (!ext) {
    if (mime.includes('mp4') || mime === 'video/mp4') ext = '.mp4';
    else if (mime.includes('quicktime') || mime.includes('mov')) ext = '.mov';
    else if (mime.includes('webm')) ext = '.webm';
    else if (mime.startsWith('video/')) ext = '.mp4';
    else if (mime.includes('png')) ext = '.png';
    else if (mime.includes('jpeg') || mime.includes('jpg')) ext = '.jpg';
    else if (mime.includes('pdf')) ext = '.pdf';

    if (ext) {
      const base = current.replace(/\.[^.]*$/, '') || 'upload';
      file.originalname = `${base}${ext}`;
    }
  }

  return file;
}

export function assertSafeUpload(
  file: Express.Multer.File | undefined | null,
  options: FileValidationOptions,
): void {
  if (!file) {
    throw new HttpException('File is required.', HttpStatus.BAD_REQUEST);
  }

  normalizeUploadFileName(file);

  // Video files must never be rejected just because the route said "document".
  let kind = options.kind;
  const finalExt = path.extname(file.originalname || '').toLowerCase();
  const finalMime = (file.mimetype || '').toLowerCase().trim();
  if (kind === 'document' && SAFE_VIDEO_EXTENSIONS.has(finalExt)) {
    kind = 'video';
  } else if (kind === 'document' && finalMime.startsWith('video/')) {
    kind = 'video';
  }

  const { extensions, mimes, defaultMaxBytes } = allowedForKind(kind);
  const maxSize = options.maxSizeBytes ?? defaultMaxBytes;
  if (file.size > maxSize) {
    throw new HttpException(
      `File size exceeds ${(maxSize / (1024 * 1024)).toFixed(0)}MB limit.`,
      HttpStatus.BAD_REQUEST,
    );
  }

  if (!finalExt) {
    throw new HttpException(
      'File must have a valid extension.',
      HttpStatus.BAD_REQUEST,
    );
  }

  if (DANGEROUS_EXTENSIONS.has(finalExt)) {
    throw new HttpException(
      `File type "${finalExt}" is not allowed.`,
      HttpStatus.BAD_REQUEST,
    );
  }

  if (!extensions.has(finalExt) && !SAFE_VIDEO_EXTENSIONS.has(finalExt)) {
    throw new HttpException(
      `File extension "${finalExt}" is not allowed for ${kind} uploads.`,
      HttpStatus.BAD_REQUEST,
    );
  }

  if (!finalMime || !mimes.has(finalMime)) {
    const mimeOkForVideo =
      isVideoSignal(finalExt, finalMime) &&
      SAFE_VIDEO_EXTENSIONS.has(finalExt);
    if (!mimeOkForVideo) {
      throw new HttpException(
        `File MIME type "${finalMime || 'unknown'}" is not allowed for ${kind} uploads.`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
