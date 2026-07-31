import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import * as path from 'path';
import { Readable } from 'stream';
import { JwtAuthGuard } from '../admin/auth/guards/jwt-auth.guard';
import { DocumentQueryDto, UploadDocumentDto } from './dto/upload-document.dto';
import { BufferedFile } from './interfaces/buffered-file.interface';
import { DocumentUploaderService } from './services/document-uploader.service';

const FORBIDDEN_EXTENSIONS = [
  '.js',
  '.mjs',
  '.cjs',
  '.exe',
  '.sh',
  '.bat',
  '.cmd',
  '.html',
  '.htm',
  '.xhtml',
  '.php',
  '.asp',
  '.aspx',
];

@Controller('object-store')
@UseGuards(JwtAuthGuard)
export class ObjectStoreController {
  constructor(
    private readonly documentUploaderService: DocumentUploaderService,
  ) {}

  private assertSafeUpload(file: Express.Multer.File) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (FORBIDDEN_EXTENSIONS.includes(ext)) {
      throw new BadRequestException(
        'Security violation: Dangerous file extension uploaded.',
      );
    }
  }

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Query() query: UploadDocumentDto,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    this.assertSafeUpload(file);

    const bufferedFile: BufferedFile = {
      fieldname: file.fieldname,
      originalname: file.originalname,
      encoding: file.encoding,
      mimetype: file.mimetype,
      size: file.size,
      buffer: file.buffer,
    };

    return this.documentUploaderService.uploadImage(bufferedFile, {
      entityType: query.entityType,
      entityId: query.entityId,
      refType: query.refType,
      refId: query.refId,
    });
  }

  /** Return existing uploaded URL for a ref without touching MinIO. */
  @Get('by-ref')
  async getByRef(@Query('refId') refId: string) {
    if (!refId?.trim()) throw new BadRequestException('refId required');
    const docs = await this.documentUploaderService.findByRefId(refId.trim());
    const latest = docs[0];
    if (!latest?.imageUrl) {
      throw new NotFoundException('No document for this ref');
    }
    return {
      id: latest.id,
      image_url: latest.imageUrl,
      key: latest.fileKey,
      fileName: latest.filename,
      message: 'Existing upload',
    };
  }

  @Get('documents')
  async listDocuments(@Query() query: DocumentQueryDto) {
    if (!query.entityType || query.entityId == null) {
      return this.documentUploaderService.listRecent();
    }
    if (query.refType) {
      return this.documentUploaderService.getDocsByRef(
        query.entityType,
        query.entityId,
        query.refType,
      );
    }
    return this.documentUploaderService.getAllDocs(
      query.entityType,
      query.entityId,
    );
  }

  @Get('documents/:id')
  async getDocument(@Param('id', ParseIntPipe) id: number) {
    return this.documentUploaderService.findById(id);
  }

  @Get('download/:id')
  async downloadById(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const doc = await this.documentUploaderService.findById(id);
    const fileStream = await this.documentUploaderService.downloadFile(
      doc.fileKey,
    );

    res.setHeader(
      'Content-Type',
      fileStream.ContentType || doc.mimetype || 'application/octet-stream',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(doc.filename)}"`,
    );
    if (fileStream.ContentLength) {
      res.setHeader('Content-Length', fileStream.ContentLength);
    }

    (fileStream.Body as Readable).pipe(res);
  }

  @Get('view-by-url')
  async viewByUrl(@Query('url') url: string, @Res() res: Response) {
    if (!url) throw new BadRequestException('URL required');
    const doc = await this.documentUploaderService.findByUrl(url);
    if (!doc) {
      // Never redirect phones to MinIO's 127.0.0.1 URL — they cannot reach it.
      const isLoopback =
        /127\.0\.0\.1|localhost/i.test(url) ||
        url.startsWith('http://0.0.0.0');
      if (
        !isLoopback &&
        (url.startsWith('http://') || url.startsWith('https://'))
      ) {
        return res.redirect(url);
      }
      throw new BadRequestException('Document not found for URL');
    }
    const fileStream = await this.documentUploaderService.downloadFile(doc.fileKey);
    res.setHeader('Content-Type', fileStream.ContentType || doc.mimetype || 'image/jpeg');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.filename)}"`);
    (fileStream.Body as Readable).pipe(res);
  }

  @Get('download-by-url')
  async downloadByUrl(@Query('url') url: string, @Res() res: Response) {
    if (!url) throw new BadRequestException('URL required');
    const doc = await this.documentUploaderService.findByUrl(url);
    if (!doc) {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return res.redirect(url);
      }
      throw new BadRequestException('Invalid document URL');
    }
    const fileStream = await this.documentUploaderService.downloadFile(doc.fileKey);
    res.setHeader('Content-Type', fileStream.ContentType || doc.mimetype || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.filename)}"`);
    (fileStream.Body as Readable).pipe(res);
  }

  @Delete('by-url')
  async deleteByUrl(@Query('url') url: string) {
    return this.documentUploaderService.deleteByUrl(url);
  }

  @Delete('by-ref')
  async deleteByRef(@Query('refId') refId: string) {
    return this.documentUploaderService.deleteByRef(refId);
  }

  @Delete('documents/:id')
  async deleteDocument(@Param('id', ParseIntPipe) id: number) {
    return this.documentUploaderService.deleteDoc(id);
  }
}
