import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
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

  @Delete('documents/:id')
  async deleteDocument(@Param('id', ParseIntPipe) id: number) {
    return this.documentUploaderService.deleteDoc(id);
  }
}
