import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentMetaInfoEntity } from './entities/document-meta-info.entity';
import { ObjectStoreController } from './object-store.controller';
import { DocumentUploaderService } from './services/document-uploader.service';
import { S3ClientService } from './services/s3-client.service';

@Module({
  imports: [TypeOrmModule.forFeature([DocumentMetaInfoEntity])],
  controllers: [ObjectStoreController],
  providers: [S3ClientService, DocumentUploaderService],
  exports: [DocumentUploaderService, S3ClientService, TypeOrmModule],
})
export class ObjectStoreModule {}
