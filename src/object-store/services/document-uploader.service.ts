import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentMetaInfoEntity } from '../entities/document-meta-info.entity';
import { EntityType } from '../enums/entity-type.enum';
import { ReferenceType } from '../enums/reference-type.enum';
import { BufferedFile } from '../interfaces/buffered-file.interface';
import { DocumentMetaInfo } from '../interfaces/document-meta-info.interface';
import { S3ClientService } from './s3-client.service';

export interface UploadResult {
  id: number;
  image_url: string;
  key: string;
  fileName: string;
  message: string;
}

@Injectable()
export class DocumentUploaderService {
  constructor(
    private readonly s3ClientService: S3ClientService,
    @InjectRepository(DocumentMetaInfoEntity)
    private readonly documentRepository: Repository<DocumentMetaInfoEntity>,
  ) {}

  private buildFileKey(meta: DocumentMetaInfo, originalFilename: string): string {
    const safeName = originalFilename.replace(/[/\\]/g, '_');
    return `${meta.entityType}/${meta.entityId}/${Date.now()}-${safeName}`;
  }

  async uploadImage(
    file: BufferedFile,
    meta: DocumentMetaInfo,
  ): Promise<UploadResult> {
    const key = this.buildFileKey(meta, file.originalname);
    const imageUrl = await this.s3ClientService.upload(file, key);

    const record = this.documentRepository.create({
      entityType: meta.entityType,
      entityId: meta.entityId,
      refType: meta.refType,
      refId: String(meta.refId),
      fileKey: key,
      filename: file.originalname,
      fileSize: file.size,
      mimetype: file.mimetype,
      imageUrl,
    });

    const saved = await this.documentRepository.save(record);

    return {
      id: saved.id,
      image_url: imageUrl,
      key,
      fileName: file.originalname,
      message: 'Image upload successful',
    };
  }

  async listRecent(limit = 200): Promise<DocumentMetaInfoEntity[]> {
    return this.documentRepository.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getAllDocs(
    entityType: EntityType,
    entityId: number,
  ): Promise<DocumentMetaInfoEntity[]> {
    return this.documentRepository.find({
      where: { entityType, entityId },
      order: { createdAt: 'DESC' },
    });
  }

  async getDocsByRef(
    entityType: EntityType,
    entityId: number,
    refType: ReferenceType,
  ): Promise<DocumentMetaInfoEntity[]> {
    return this.documentRepository.find({
      where: { entityType, entityId, refType },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: number): Promise<DocumentMetaInfoEntity> {
    const doc = await this.documentRepository.findOne({ where: { id } });
    if (!doc) {
      throw new NotFoundException(`Document with id ${id} not found`);
    }
    return doc;
  }

  async findByKey(fileKey: string): Promise<DocumentMetaInfoEntity> {
    const doc = await this.documentRepository.findOne({ where: { fileKey } });
    if (!doc) {
      throw new NotFoundException(`Document with key ${fileKey} not found`);
    }
    return doc;
  }

  async findByUrl(url: string): Promise<DocumentMetaInfoEntity | null> {
    if (!url) return null;
    let decoded = url.trim();
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      /* keep raw */
    }

    const exact =
      (await this.documentRepository.findOne({ where: { imageUrl: decoded } })) ||
      (decoded !== url
        ? await this.documentRepository.findOne({ where: { imageUrl: url.trim() } })
        : null);
    if (exact) return exact;

    // Fallback: match by path so localhost vs 127.0.0.1 still resolves for mobile preview.
    try {
      const pathname = new URL(decoded).pathname;
      if (pathname.length > 8) {
        return this.documentRepository
          .createQueryBuilder('d')
          .where('d.imageUrl LIKE :suffix', { suffix: `%${pathname}` })
          .orderBy('d.createdAt', 'DESC')
          .getOne();
      }
    } catch {
      /* ignore invalid URL */
    }
    return null;
  }

  async findByRefId(refId: string): Promise<DocumentMetaInfoEntity[]> {
    if (!refId) return [];
    return this.documentRepository.find({
      where: { refId: String(refId) },
      order: { createdAt: 'DESC' },
    });
  }

  async downloadFile(fileKey: string) {
    return this.s3ClientService.downloadFile(fileKey);
  }

  async deleteDoc(documentId: number): Promise<{ message: string }> {
    const doc = await this.findById(documentId);
    try {
      await this.s3ClientService.delete(doc.fileKey);
    } catch {}
    await this.documentRepository.remove(doc);
    return { message: 'Document deleted successfully' };
  }

  async deleteByUrl(url: string): Promise<{ message: string }> {
    if (!url) return { message: 'No URL provided' };
    const doc = await this.documentRepository.findOne({ where: { imageUrl: url } });
    if (doc) {
      try {
        await this.s3ClientService.delete(doc.fileKey);
      } catch {}
      await this.documentRepository.remove(doc);
    }
    return { message: 'Document deleted successfully' };
  }

  async deleteByRef(refId: string): Promise<{ message: string }> {
    if (!refId) return { message: 'No refId provided' };
    const docs = await this.documentRepository.find({ where: { refId: String(refId) } });
    for (const doc of docs) {
      try {
        await this.s3ClientService.delete(doc.fileKey);
      } catch {}
      await this.documentRepository.remove(doc);
    }
    return { message: 'Documents deleted successfully' };
  }
}
