import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import { BufferedFile } from '../interfaces/buffered-file.interface';

@Injectable()
export class S3ClientService implements OnModuleInit {
  private readonly logger = new Logger(S3ClientService.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    const require = (key: string) => {
      const value = this.configService.get<string>(key);
      if (value == null || String(value).trim() === '') {
        throw new Error(`Missing required env: ${key}`);
      }
      return String(value).trim();
    };

    const endpointRaw = require('MINIO_ENDPOINT');
    const port = require('MINIO_PORT');
    const region = require('AWS_REGION');
    const accessKey = require('MINIO_ACCESS_KEY');
    const secretKey = require('MINIO_SECRET_KEY');
    this.bucket = require('MINIO_BUCKET_NAME');

    const endpoint = this.normalizeEndpoint(endpointRaw, port);
    this.publicBaseUrl = `${endpoint}/${this.bucket}`;

    this.s3Client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
      forcePathStyle: true,
      maxAttempts: 1,
      requestHandler: {
        requestTimeout: 3000,   // 3 s — fail fast if MinIO is unreachable
        connectionTimeout: 3000,
      } as any,
    });

    this.logger.log(`S3 client configured for bucket "${this.bucket}" at ${endpoint}`);
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureBucketExists();
    } catch (error: any) {
      // Do NOT crash the app if MinIO is unreachable (e.g. local dev without MinIO running).
      // File upload/download endpoints will still fail, but auth and all other APIs work fine.
      this.logger.warn(
        `MinIO is unreachable — bucket check skipped. File operations will be unavailable. ` +
        `Reason: ${error?.message || error}`,
      );
    }
  }

  private async ensureBucketExists(): Promise<void> {
    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Bucket "${this.bucket}" is ready`);
      return;
    } catch (error: any) {
      const status = error?.$metadata?.httpStatusCode;
      const code = error?.name || error?.Code;
      // Missing bucket → create it. Other errors (auth, network) → rethrow to onModuleInit.
      if (status !== 404 && code !== 'NotFound' && code !== 'NoSuchBucket') {
        this.logger.warn(
          `Skipping bucket check for "${this.bucket}" (storage unreachable): ${error?.message || error}`,
        );
        return;
      }
    }

    try {
      await this.s3Client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Created missing bucket "${this.bucket}"`);
    } catch (error: any) {
      // Race: another process may have created it
      if (error?.name === 'BucketAlreadyOwnedByYou' || error?.name === 'BucketAlreadyExists') {
        this.logger.log(`Bucket "${this.bucket}" already exists`);
        return;
      }
      this.logger.warn(
        `Skipping bucket create for "${this.bucket}" (storage unreachable): ${error?.message || error}`,
      );
    }
  }

  private normalizeEndpoint(endpointRaw: string, port: string): string {
    const trimmed = endpointRaw.replace(/\/$/, '');
    try {
      const url = new URL(trimmed.includes('://') ? trimmed : `http://${trimmed}`);
      if (!url.port && port) {
        url.port = port;
      }
      return url.origin;
    } catch {
      return `http://127.0.0.1:${port}`;
    }
  }

  buildPublicUrl(key: string): string {
    return `${this.publicBaseUrl}/${key}`;
  }

  async upload(file: BufferedFile, key: string): Promise<string> {
    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          ContentLength: file.size,
        }),
      );
    } catch (error: any) {
      const code = error?.code || error?.name || '';
      if (code === 'ECONNREFUSED' || String(error?.message || '').includes('ECONNREFUSED')) {
        throw new Error(
          'File storage (MinIO) is not running on port 9000. Start MinIO, then try again.',
        );
      }
      throw error;
    }
    return this.buildPublicUrl(key);
  }

  async downloadFile(key: string): Promise<{
    Body: Readable;
    ContentType?: string;
    ContentLength?: number;
    Metadata?: Record<string, string>;
  }> {
    try {
      const result = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );

      if (!result.Body) {
        throw new NotFoundException(`File not found for key: ${key}`);
      }

      return {
        Body: result.Body as Readable,
        ContentType: result.ContentType,
        ContentLength: result.ContentLength,
        Metadata: result.Metadata,
      };
    } catch (error: any) {
      if (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) {
        throw new NotFoundException(`File not found for key: ${key}`);
      }
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  async getMetaData(key: string) {
    try {
      return await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
    } catch (error: any) {
      if (error?.name === 'NotFound' || error?.$metadata?.httpStatusCode === 404) {
        throw new NotFoundException(`File metadata not found for key: ${key}`);
      }
      throw error;
    }
  }
}
